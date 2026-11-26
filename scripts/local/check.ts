// ローカルの各コンポーネントの疎通確認。local-up の後に実行する。
//   bun run local:check
import {
  AdminDeleteUserCommand,
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SetUserMFAPreferenceCommand,
  SignUpCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQL } from "bun";
import { join } from "node:path";
import { findStoredUser, totpCode } from "./cognito-local";
import { LOCAL } from "./config";

const root = process.env.DEVENV_ROOT ?? join(import.meta.dir, "..", "..");
const state = await Bun.file(join(root, ".local", "state.json")).json();
const now = new Date().toISOString();
let failed = false;

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    const result = await fn();
    console.log(`ok   ${name}: ${JSON.stringify(result)}`);
  } catch (e) {
    failed = true;
    console.log(`FAIL ${name}: ${(e as Error).name}: ${(e as Error).message}`);
  }
}

await step("tidb", async () => {
  const sql = new SQL(`mysql://root@${LOCAL.tidbHost}:${LOCAL.tidbPort}/${LOCAL.tidbDatabase}`);
  try {
    const [{ v }] = await sql`SELECT tidb_version() AS v`;
    await sql`CREATE TABLE IF NOT EXISTS local_check (id INT PRIMARY KEY, at VARCHAR(64))`;
    await sql`REPLACE INTO local_check (id, at) VALUES (1, ${now})`;
    const [row] = await sql`SELECT at FROM local_check WHERE id = 1`;
    return { version: String(v).split("\n")[0], roundTrip: row.at === now };
  } finally {
    await sql.close();
  }
});

await step("dynamodb", async () => {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: LOCAL.dynamodbEndpoint }));
  await doc.send(new PutCommand({ TableName: LOCAL.tableName, Item: { pk: "check", sk: "1", at: now } }));
  const got = await doc.send(new GetCommand({ TableName: LOCAL.tableName, Key: { pk: "check", sk: "1" } }));
  return { table: LOCAL.tableName, roundTrip: got.Item?.at === now };
});

await step("cognito-local", async () => {
  const client = new CognitoIdentityProviderClient({ endpoint: LOCAL.cognitoEndpoint });
  const res = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: state.userPoolClientId,
      AuthParameters: { USERNAME: LOCAL.testUser.username, PASSWORD: LOCAL.testUser.password },
    }),
  );
  const idToken = res.AuthenticationResult?.IdToken;
  if (!idToken) throw new Error("no IdToken");
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  const jwks = await fetch(`${LOCAL.cognitoEndpoint}/${state.userPoolId}/.well-known/jwks.json`).then(
    (r) => r.json() as Promise<{ keys: unknown[] }>,
  );
  return {
    tokens: Object.keys(res.AuthenticationResult ?? {}),
    iss: payload.iss,
    tokenUse: payload.token_use,
    jwksKeys: jwks.keys.length,
  };
});

const cognito = new CognitoIdentityProviderClient({ endpoint: LOCAL.cognitoEndpoint });

/** パスワードでサインインし、TOTP のチャレンジが出たらコードを入れて、トークンまで取る。 */
async function signInWithTotp(username: string, password: string, secret: string) {
  const first = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: state.userPoolClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
  );
  if (first.ChallengeName !== "SOFTWARE_TOKEN_MFA") {
    throw new Error(`TOTP のチャレンジが出ない(${first.ChallengeName ?? "トークンが出た"})`);
  }
  const second = await cognito.send(
    new RespondToAuthChallengeCommand({
      ClientId: state.userPoolClientId,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: first.Session,
      ChallengeResponses: { USERNAME: username, SOFTWARE_TOKEN_MFA_CODE: totpCode(secret) },
    }),
  );
  if (!second.AuthenticationResult?.AccessToken) throw new Error("TOTP の後にトークンが出ない");
  return { challenge: first.ChallengeName, tokens: Object.keys(second.AuthenticationResult) };
}

await step("cognito-local: TOTP でサインイン(mfa@example.com)", () =>
  signInWithTotp(state.mfaUser.username, state.mfaUser.password, state.mfaUser.totpSecret),
);

await step("cognito-local: サインアップ → 確認 → TOTP 登録 → TOTP でサインイン", async () => {
  const email = `check-${Date.now()}@example.com`;
  const password = LOCAL.testUser.password;
  try {
    await cognito.send(
      new SignUpCommand({
        ClientId: state.userPoolClientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: "email", Value: email }],
      }),
    );
    // cognito-local はメールを送らない。確認コードは、データのファイルから読む。
    const code = (await findStoredUser(state.userPoolId, email))?.ConfirmationCode;
    if (!code) throw new Error("確認コードが見つからない");
    await cognito.send(new ConfirmSignUpCommand({ ClientId: state.userPoolClientId, Username: email, ConfirmationCode: code }));
    // ローカルは MFA が OPTIONAL なので、未登録ならトークンが出る(アプリは、ここで登録を強制する)。
    const first = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: state.userPoolClientId,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    );
    const accessToken = first.AuthenticationResult?.AccessToken;
    if (!accessToken) throw new Error(`初回のサインインでトークンが出ない(${first.ChallengeName})`);
    const { SecretCode } = await cognito.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
    await cognito.send(new VerifySoftwareTokenCommand({ AccessToken: accessToken, UserCode: totpCode(SecretCode!) }));
    await cognito.send(
      new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      }),
    );
    return await signInWithTotp(email, password, SecretCode!);
  } finally {
    await cognito
      .send(new AdminDeleteUserCommand({ UserPoolId: state.userPoolId, Username: email }))
      .catch(() => undefined);
  }
});

process.exit(failed ? 1 : 0);
