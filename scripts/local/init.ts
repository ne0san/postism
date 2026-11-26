// ローカル環境の初期化。何度実行しても壊れない(あれば作らない)。
// 作るもの:
//   - cognito-local: ユーザープール(ログインの設定)、アプリクライアント、テストユーザー2人
//     (test@example.com は MFA なし、mfa@example.com は TOTP 登録済み)
//   - DynamoDB Local: テーブル postism-local
//   - TiDB: データベース postism
// 結果(プール ID など)は .local/state.json と .local/env に書く(どちらも gitignore 済み)。
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  AssociateSoftwareTokenCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  DescribeUserPoolCommand,
  GetUserPoolMfaConfigCommand,
  InitiateAuthCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
  SetUserMFAPreferenceCommand,
  SetUserPoolMfaConfigCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";
import { SQL } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { findStoredUser, totpCode } from "./cognito-local";
import { APP_CLIENT_SETTINGS, LOCAL, USER_POOL_SETTINGS } from "./config";
import { type Profile, validateProfile } from "./profile";

const root = process.env.DEVENV_ROOT ?? join(import.meta.dir, "..", "..");

async function initCognito() {
  const client = new CognitoIdentityProviderClient({ endpoint: LOCAL.cognitoEndpoint });

  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  let poolId = pools.UserPools?.find((p) => p.Name === LOCAL.userPoolName)?.Id;
  if (!poolId) {
    const created = await client.send(
      new CreateUserPoolCommand({ PoolName: LOCAL.userPoolName, ...USER_POOL_SETTINGS }),
    );
    poolId = created.UserPool!.Id!;
    // TOTP を有効にする(SMS は設定しない)。
    await client.send(
      new SetUserPoolMfaConfigCommand({
        UserPoolId: poolId,
        MfaConfiguration: USER_POOL_SETTINGS.MfaConfiguration,
        SoftwareTokenMfaConfiguration: { Enabled: true },
      }),
    );
    console.log(`cognito: created user pool ${poolId}`);
  } else {
    console.log(`cognito: user pool exists ${poolId}`);
    await assertPoolSettings(client, poolId);
  }

  const clients = await client.send(
    new ListUserPoolClientsCommand({ UserPoolId: poolId, MaxResults: 60 }),
  );
  let clientId = clients.UserPoolClients?.find((c) => c.ClientName === LOCAL.clientName)?.ClientId;
  if (!clientId) {
    const created = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: poolId,
        ClientName: LOCAL.clientName,
        ...APP_CLIENT_SETTINGS,
      }),
    );
    clientId = created.UserPoolClient!.ClientId!;
    console.log(`cognito: created app client ${clientId}`);
  } else {
    console.log(`cognito: app client exists ${clientId}`);
  }

  await ensureUser(client, poolId, LOCAL.testUser);
  await ensureUser(client, poolId, LOCAL.mfaUser);
  const mfaUserTotpSecret = await ensureTotp(client, poolId, clientId, LOCAL.mfaUser);

  return { userPoolId: poolId, userPoolClientId: clientId, mfaUserTotpSecret };
}

/** 既存のプールが、古い設定(ログインの設定を入れる前)のままなら止める。 */
async function assertPoolSettings(client: CognitoIdentityProviderClient, poolId: string) {
  const { UserPool } = await client.send(new DescribeUserPoolCommand({ UserPoolId: poolId }));
  const mfa = await client.send(new GetUserPoolMfaConfigCommand({ UserPoolId: poolId }));
  const outdated =
    UserPool?.MfaConfiguration !== USER_POOL_SETTINGS.MfaConfiguration ||
    UserPool?.Policies?.PasswordPolicy?.MinimumLength !== USER_POOL_SETTINGS.Policies.PasswordPolicy.MinimumLength ||
    mfa.SoftwareTokenMfaConfiguration?.Enabled !== true;
  if (outdated) {
    throw new Error(
      [
        `cognito: ユーザープール ${poolId} の設定が古い(ログインの設定を入れる前に作ったもの)。`,
        "作り直すには、local-down → local-reset → local-up を実行してください(ローカルのデータが消えます)。",
      ].join("\n"),
    );
  }
}

type LocalUser = { username: string; password: string };

async function ensureUser(client: CognitoIdentityProviderClient, poolId: string, user: LocalUser) {
  let exists = true;
  try {
    await client.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: user.username }));
  } catch (e) {
    if ((e as Error).name !== "UserNotFoundException") throw e;
    exists = false;
  }
  if (!exists) {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: user.username,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: user.username },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );
    console.log(`cognito: created user ${user.username}`);
  } else {
    console.log(`cognito: user exists ${user.username}`);
  }
  // パスワードは毎回揃える(FORCE_CHANGE_PASSWORD を解消するため)。
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: user.username,
      Password: user.password,
      Permanent: true,
    }),
  );
}

/**
 * ユーザーに TOTP を登録する(登録済みなら、そのシークレットを返す)。
 * ローカルは MFA が OPTIONAL なので、未登録のユーザーはサインインでトークンが出る。
 * そのアクセストークンで登録する(dev と本番の MFA_SETUP とは別の経路。cognito-local は MFA_SETUP に非対応)。
 */
async function ensureTotp(
  client: CognitoIdentityProviderClient,
  poolId: string,
  clientId: string,
  user: LocalUser,
): Promise<string> {
  const stored = await findStoredUser(poolId, user.username);
  if (stored?.SoftwareTokenMfaConfiguration?.Verified) {
    console.log(`cognito: TOTP already registered for ${user.username}`);
    return stored.SoftwareTokenMfaConfiguration.Secret;
  }
  const auth = await client.send(
    new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: { USERNAME: user.username, PASSWORD: user.password },
    }),
  );
  const accessToken = auth.AuthenticationResult?.AccessToken;
  if (!accessToken) throw new Error(`cognito: ${user.username} のトークンが出ない(${auth.ChallengeName})`);
  const { SecretCode } = await client.send(new AssociateSoftwareTokenCommand({ AccessToken: accessToken }));
  await client.send(
    new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: totpCode(SecretCode!),
      FriendlyDeviceName: "local",
    }),
  );
  await client.send(
    new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    }),
  );
  console.log(`cognito: registered TOTP for ${user.username}`);
  return SecretCode!;
}

async function initDynamo() {
  const client = new DynamoDBClient({ endpoint: LOCAL.dynamodbEndpoint });
  try {
    await client.send(new DescribeTableCommand({ TableName: LOCAL.tableName }));
    console.log(`dynamodb: table exists ${LOCAL.tableName}`);
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
    await client.send(
      new CreateTableCommand({
        TableName: LOCAL.tableName,
        BillingMode: "PAY_PER_REQUEST",
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" },
        ],
      }),
    );
    await waitUntilTableExists({ client, maxWaitTime: 30 }, { TableName: LOCAL.tableName });
    console.log(`dynamodb: created table ${LOCAL.tableName}`);
  }
}

async function initTidb() {
  const sql = new SQL(`mysql://root@${LOCAL.tidbHost}:${LOCAL.tidbPort}/`);
  try {
    await sql.unsafe(`CREATE DATABASE IF NOT EXISTS \`${LOCAL.tidbDatabase}\``);
    console.log(`tidb: database ready ${LOCAL.tidbDatabase}`);
  } finally {
    await sql.close();
  }
}

const cognito = await initCognito().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
await initDynamo();
await initTidb();

const state = {
  cognitoEndpoint: LOCAL.cognitoEndpoint,
  dynamodbEndpoint: LOCAL.dynamodbEndpoint,
  tableName: LOCAL.tableName,
  tidb: { host: LOCAL.tidbHost, port: LOCAL.tidbPort, user: "root", database: LOCAL.tidbDatabase },
  userPoolId: cognito.userPoolId,
  userPoolClientId: cognito.userPoolClientId,
  testUser: LOCAL.testUser,
  // ローカルのエミュレーター用。秘密ではない(.local/ は gitignore 済み)。
  mfaUser: { ...LOCAL.mfaUser, totpSecret: cognito.mfaUserTotpSecret },
};
const dir = join(root, ".local");
await mkdir(dir, { recursive: true });
await Bun.write(join(dir, "state.json"), JSON.stringify(state, null, 2) + "\n");
await Bun.write(
  join(dir, "env"),
  [
    `LOCAL_USER_POOL_ID=${cognito.userPoolId}`,
    `LOCAL_USER_POOL_CLIENT_ID=${cognito.userPoolClientId}`,
    `EXPO_PUBLIC_COGNITO_ENDPOINT=${LOCAL.cognitoEndpoint}`,
    `EXPO_PUBLIC_USER_POOL_ID=${cognito.userPoolId}`,
    `EXPO_PUBLIC_USER_POOL_CLIENT_ID=${cognito.userPoolClientId}`,
    "",
  ].join("\n"),
);
// 接続先のプロファイル(local)。アプリへの受け渡しは scripts/local/profile.ts で行う。
const issuer = `${LOCAL.cognitoEndpoint}/${cognito.userPoolId}`;
const localProfile: Profile = validateProfile(
  {
    env: "local",
    region: process.env.AWS_REGION ?? "ap-northeast-1",
    cognito: {
      endpoint: LOCAL.cognitoEndpoint,
      userPoolId: cognito.userPoolId,
      iosClientId: cognito.userPoolClientId,
      // BFF 用のクライアントは、BFF を作るときに分ける。それまでは同じクライアントを使う。
      webClientId: cognito.userPoolClientId,
      authFlow: "USER_PASSWORD_AUTH",
      issuer,
      jwksUri: `${issuer}/.well-known/jwks.json`,
    },
    api: { baseUrl: "http://127.0.0.1:3000" },
  },
  "local",
);
await mkdir(join(dir, "profiles"), { recursive: true });
await Bun.write(join(dir, "profiles", "local.json"), JSON.stringify(localProfile, null, 2) + "\n");
console.log(`wrote ${join(".local", "state.json")}, ${join(".local", "env")} and ${join(".local", "profiles", "local.json")}`);
