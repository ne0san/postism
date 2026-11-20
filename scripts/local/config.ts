// ローカル環境の固定値。どれもローカルのエミュレーター用で、秘密ではない。
// 本番や開発環境の値は、ここに書かない。
export const LOCAL = {
  cognitoEndpoint: process.env.LOCAL_COGNITO_ENDPOINT ?? "http://127.0.0.1:9229",
  dynamodbEndpoint: process.env.LOCAL_DYNAMODB_ENDPOINT ?? "http://127.0.0.1:8000",
  tidbHost: process.env.LOCAL_TIDB_HOST ?? "127.0.0.1",
  tidbPort: Number(process.env.LOCAL_TIDB_PORT ?? 4000),
  tidbDatabase: "postism",
  tableName: "postism-local",
  userPoolName: "postism-local",
  clientName: "postism-local-client",
  testUser: {
    username: "test@example.com",
    password: "LocalPassw0rd!",
  },
} as const;
