// 疎通確認用の Lambda。サービスの機能ではない。
// Bearer トークン(cognito-local のアクセストークン)を検証し、DynamoDB と TiDB に1件ずつ書いて読む。
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { JwtRsaVerifier } from "aws-jwt-verify";
import { SimpleJwksCache } from "aws-jwt-verify/jwk";
import mysql from "mysql2/promise";

type Event = { headers?: Record<string, string | undefined>; requestContext?: { http?: { method?: string } } };

const env = process.env;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "POST,OPTIONS",
};
const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { "content-type": "application/json", ...cors },
  body: JSON.stringify(body),
});

// aws-jwt-verify の既定の fetcher は https: しか受け付けない。cognito-local の JWKS は http: なので、
// ローカル用に fetch をそのまま使う fetcher に差し替える(本番の Cognito は https: なので不要)。
const jwksCache = new SimpleJwksCache({
  fetcher: { fetch: async (uri: string) => (await fetch(uri)).arrayBuffer() },
});

const verifier = JwtRsaVerifier.create({
  issuer: env.COGNITO_ISSUER!,
  jwksUri: env.COGNITO_JWKS_URI!,
  audience: null, // アクセストークンには aud が無い。client_id を下で確かめる。
  customJwtCheck: ({ payload }) => {
    if (payload.token_use !== "access") throw new Error("token_use is not access");
    if (payload.client_id !== env.COGNITO_CLIENT_ID) throw new Error("client_id mismatch");
  },
}, { jwksCache });

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ endpoint: env.DYNAMODB_ENDPOINT }));

export const handler = async (event: Event) => {
  if (event.requestContext?.http?.method === "OPTIONS") return { statusCode: 204, headers: cors };

  const auth = event.headers?.authorization ?? event.headers?.Authorization;
  const token = auth?.replace(/^Bearer\s+/i, "");
  let username: string;
  try {
    const payload = await verifier.verify(token ?? "");
    username = String(payload.username);
  } catch (e) {
    return json(401, { error: "unauthorized", reason: (e as Error).message });
  }

  const at = new Date().toISOString();
  const result: Record<string, unknown> = { username, at, runtime: `node ${process.versions.node}` };

  try {
    await doc.send(new PutCommand({ TableName: env.TABLE_NAME, Item: { pk: `smoke#${username}`, sk: at, at } }));
    const got = await doc.send(new GetCommand({ TableName: env.TABLE_NAME, Key: { pk: `smoke#${username}`, sk: at } }));
    result.dynamodb = { ok: got.Item?.at === at };
  } catch (e) {
    result.dynamodb = { ok: false, error: (e as Error).message };
  }

  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({
      host: env.TIDB_HOST,
      port: Number(env.TIDB_PORT),
      user: "root",
      database: env.TIDB_DATABASE,
    });
    await conn.query("CREATE TABLE IF NOT EXISTS smoke (id BIGINT AUTO_RANDOM PRIMARY KEY, username VARCHAR(255), at VARCHAR(64))");
    await conn.execute("INSERT INTO smoke (username, at) VALUES (?, ?)", [username, at]);
    const [rows] = await conn.execute("SELECT COUNT(*) AS n FROM smoke WHERE username = ?", [username]);
    result.tidb = { ok: true, rowsForUser: (rows as { n: number }[])[0].n };
  } catch (e) {
    result.tidb = { ok: false, error: (e as Error).message };
  } finally {
    await conn?.end();
  }

  return json(200, result);
};
