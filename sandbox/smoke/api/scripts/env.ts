// .local/state.json(local-init が作る)から、sam local に渡す環境変数ファイルを作る。
// 出力: .local/smoke-env.json(gitignore 済み)。コンテナからホストへは host.docker.internal で届く。
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..", "..", "..");
const st = await Bun.file(join(root, ".local", "state.json")).json();
const host = "host.docker.internal";
const env = {
  SmokeFunction: {
    TABLE_NAME: st.tableName,
    DYNAMODB_ENDPOINT: `http://${host}:8000`,
    TIDB_HOST: host,
    TIDB_PORT: String(st.tidb.port),
    TIDB_DATABASE: st.tidb.database,
    // iss はトークンに書かれた値(ホスト側の URL)。JWKS はコンテナから取りに行く URL。
    COGNITO_ISSUER: `${st.cognitoEndpoint}/${st.userPoolId}`,
    COGNITO_JWKS_URI: `http://${host}:9229/${st.userPoolId}/.well-known/jwks.json`,
    COGNITO_CLIENT_ID: st.userPoolClientId,
  },
};
await Bun.write(join(root, ".local", "smoke-env.json"), JSON.stringify(env, null, 2) + "\n");
console.log("wrote .local/smoke-env.json");
