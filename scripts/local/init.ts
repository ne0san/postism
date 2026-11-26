// ローカル環境の初期化。何度実行しても壊れない(あれば作らない)。
// 作るもの:
//   - cognito-local: ユーザープール、アプリクライアント、テストユーザー
//   - DynamoDB Local: テーブル postism-local
//   - TiDB: データベース postism
// 結果(プール ID など)は .local/state.json と .local/env に書く(どちらも gitignore 済み)。
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
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
import { LOCAL } from "./config";
import { type Profile, validateProfile } from "./profile";

const root = process.env.DEVENV_ROOT ?? join(import.meta.dir, "..", "..");

async function initCognito() {
  const client = new CognitoIdentityProviderClient({ endpoint: LOCAL.cognitoEndpoint });

  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  let poolId = pools.UserPools?.find((p) => p.Name === LOCAL.userPoolName)?.Id;
  if (!poolId) {
    const created = await client.send(
      new CreateUserPoolCommand({
        PoolName: LOCAL.userPoolName,
        UsernameAttributes: ["email"],
      }),
    );
    poolId = created.UserPool!.Id!;
    console.log(`cognito: created user pool ${poolId}`);
  } else {
    console.log(`cognito: user pool exists ${poolId}`);
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
        ExplicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      }),
    );
    clientId = created.UserPoolClient!.ClientId!;
    console.log(`cognito: created app client ${clientId}`);
  } else {
    console.log(`cognito: app client exists ${clientId}`);
  }

  let userExists = true;
  try {
    await client.send(
      new AdminGetUserCommand({ UserPoolId: poolId, Username: LOCAL.testUser.username }),
    );
  } catch (e) {
    if ((e as Error).name !== "UserNotFoundException") throw e;
    userExists = false;
  }
  if (!userExists) {
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: poolId,
        Username: LOCAL.testUser.username,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: LOCAL.testUser.username },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );
    console.log(`cognito: created test user ${LOCAL.testUser.username}`);
  } else {
    console.log(`cognito: test user exists ${LOCAL.testUser.username}`);
  }
  // パスワードは毎回揃える(FORCE_CHANGE_PASSWORD を解消するため)。
  await client.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: poolId,
      Username: LOCAL.testUser.username,
      Password: LOCAL.testUser.password,
      Permanent: true,
    }),
  );

  return { userPoolId: poolId, userPoolClientId: clientId };
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

const cognito = await initCognito();
await initDynamo();
await initTidb();

const state = {
  cognitoEndpoint: LOCAL.cognitoEndpoint,
  dynamodbEndpoint: LOCAL.dynamodbEndpoint,
  tableName: LOCAL.tableName,
  tidb: { host: LOCAL.tidbHost, port: LOCAL.tidbPort, user: "root", database: LOCAL.tidbDatabase },
  ...cognito,
  testUser: LOCAL.testUser,
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
