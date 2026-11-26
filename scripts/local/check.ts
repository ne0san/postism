// ローカルの各コンポーネントの疎通確認。local-up の後に実行する。
//   bun run local:check
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQL } from "bun";
import { join } from "node:path";
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

process.exit(failed ? 1 : 0);
