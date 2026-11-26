// 接続先のプロファイル(local | dev)の型、読み込み、各アプリへの受け渡し。
//
// プロファイルは .local/profiles/<APP_ENV>.json(gitignore 済み)に置く。
//   - local.json: local-init が書く。
//   - dev.json  : オーナーが置く(ひな形は scripts/local/profile.example.dev.json)。
// APP_ENV の既定は local。
//
// 使い方(どれも APP_ENV で切り替わる):
//   bun scripts/local/profile.ts show                 # 読み込んだプロファイルを表示
//   bun scripts/local/profile.ts expo-env             # Expo 用の EXPO_PUBLIC_* を KEY=VALUE で出す
//   bun scripts/local/profile.ts exec-expo -- <cmd>   # EXPO_PUBLIC_* を付けて <cmd> を実行する
//   bun scripts/local/profile.ts sam-env              # sam local の --env-vars 用の JSON を出す
import { join } from "node:path";

export const APP_ENVS = ["local", "dev"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

// local は USER_PASSWORD_AUTH(cognito-local は SRP に対応しない)。dev と本番は SRP。
export const AUTH_FLOWS = ["USER_PASSWORD_AUTH", "USER_SRP_AUTH"] as const;
export type AuthFlow = (typeof AUTH_FLOWS)[number];

export type Profile = {
  env: AppEnv;
  region: string;
  cognito: {
    /** local だけ指定する(cognito-local)。dev は AWS の既定のエンドポイントを使う。 */
    endpoint?: string;
    userPoolId: string;
    /** iOS(端末から直接つなぐ)用のパブリッククライアント。 */
    iosClientId: string;
    /** Web の BFF 用のクライアント。BFF を作るまでは空でよい。 */
    webClientId?: string;
    authFlow: AuthFlow;
    /** トークンの iss。 */
    issuer: string;
    /** JWKS の URL。 */
    jwksUri: string;
  };
  api: {
    /** クライアントから見た API のベース URL。 */
    baseUrl: string;
  };
};

const root = process.env.DEVENV_ROOT ?? join(import.meta.dir, "..", "..");
export const profilesDir = join(root, ".local", "profiles");

export function resolveAppEnv(value = process.env.APP_ENV): AppEnv {
  const env = value && value.length > 0 ? value : "local";
  if (!(APP_ENVS as readonly string[]).includes(env)) {
    throw new Error(`APP_ENV は ${APP_ENVS.join(" か ")} を指定してください(指定された値: ${env})`);
  }
  return env as AppEnv;
}

export function validateProfile(value: unknown, env: AppEnv): Profile {
  const errors: string[] = [];
  const v = value as Partial<Profile> | null;
  const str = (x: unknown, name: string, optional = false) => {
    if (x === undefined && optional) return;
    if (typeof x !== "string" || x.length === 0) errors.push(`${name} が空か、文字列ではありません`);
  };
  if (!v || typeof v !== "object") throw new Error("プロファイルが JSON のオブジェクトではありません");
  if (v.env !== env) errors.push(`env が "${env}" ではありません(${String(v.env)})`);
  str(v.region, "region");
  str(v.cognito?.endpoint, "cognito.endpoint", true);
  str(v.cognito?.userPoolId, "cognito.userPoolId");
  str(v.cognito?.iosClientId, "cognito.iosClientId");
  if (v.cognito?.webClientId !== undefined && typeof v.cognito.webClientId !== "string") {
    errors.push("cognito.webClientId が文字列ではありません");
  }
  if (!(AUTH_FLOWS as readonly string[]).includes(String(v.cognito?.authFlow))) {
    errors.push(`cognito.authFlow は ${AUTH_FLOWS.join(" か ")} です`);
  }
  str(v.cognito?.issuer, "cognito.issuer");
  str(v.cognito?.jwksUri, "cognito.jwksUri");
  str(v.api?.baseUrl, "api.baseUrl");
  if (errors.length > 0) {
    throw new Error(`プロファイル(${env})が正しくありません:\n  - ${errors.join("\n  - ")}`);
  }
  return v as Profile;
}

export async function loadProfile(env: AppEnv = resolveAppEnv()): Promise<Profile> {
  const path = join(profilesDir, `${env}.json`);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    const hint =
      env === "local"
        ? "local-up(または local-init)を実行してください。"
        : "scripts/local/profile.example.dev.json を写して、.local/profiles/dev.json を作ってください。";
    throw new Error(`プロファイルがありません: .local/profiles/${env}.json\n${hint}`);
  }
  return validateProfile(await file.json(), env);
}

/** Expo に渡す値。EXPO_PUBLIC_ の付いた値は、アプリのバンドルに入る(秘密を入れない)。 */
export function expoEnv(p: Profile): Record<string, string> {
  return {
    EXPO_PUBLIC_APP_ENV: p.env,
    EXPO_PUBLIC_AWS_REGION: p.region,
    ...(p.cognito.endpoint ? { EXPO_PUBLIC_COGNITO_ENDPOINT: p.cognito.endpoint } : {}),
    EXPO_PUBLIC_USER_POOL_ID: p.cognito.userPoolId,
    EXPO_PUBLIC_IOS_CLIENT_ID: p.cognito.iosClientId,
    EXPO_PUBLIC_AUTH_FLOW: p.cognito.authFlow,
    EXPO_PUBLIC_API_BASE_URL: p.api.baseUrl,
  };
}

/**
 * sam local の --env-vars に渡す JSON(Parameters は全関数に効く。template に宣言した変数だけが上書きされる)。
 * local では、コンテナからホストに届くよう、127.0.0.1 を host.docker.internal に置き換える。
 * ただし iss はトークンに書かれた値なので、置き換えない。
 */
export function samEnv(p: Profile): { Parameters: Record<string, string> } {
  const fromContainer = (url: string) =>
    p.env === "local" ? url.replace("://127.0.0.1", "://host.docker.internal") : url;
  return {
    Parameters: {
      APP_ENV: p.env,
      AWS_REGION_NAME: p.region,
      ...(p.cognito.endpoint ? { COGNITO_ENDPOINT: fromContainer(p.cognito.endpoint) } : {}),
      COGNITO_USER_POOL_ID: p.cognito.userPoolId,
      COGNITO_IOS_CLIENT_ID: p.cognito.iosClientId,
      COGNITO_WEB_CLIENT_ID: p.cognito.webClientId ?? "",
      COGNITO_AUTH_FLOW: p.cognito.authFlow,
      COGNITO_ISSUER: p.cognito.issuer,
      COGNITO_JWKS_URI: fromContainer(p.cognito.jwksUri),
    },
  };
}

async function main(argv: string[]) {
  const [command, ...rest] = argv;
  const profile = await loadProfile();
  switch (command) {
    case "show":
      console.log(JSON.stringify(profile, null, 2));
      return 0;
    case "expo-env":
      for (const [k, v] of Object.entries(expoEnv(profile))) console.log(`${k}=${v}`);
      return 0;
    case "sam-env":
      console.log(JSON.stringify(samEnv(profile), null, 2));
      return 0;
    case "exec-expo": {
      const cmd = rest[0] === "--" ? rest.slice(1) : rest;
      if (cmd.length === 0) throw new Error("実行するコマンドを指定してください(例: exec-expo -- expo start --web)");
      const proc = Bun.spawn(cmd, {
        env: { ...process.env, ...expoEnv(profile) },
        stdio: ["inherit", "inherit", "inherit"],
      });
      return await proc.exited;
    }
    default:
      console.error("使い方: bun scripts/local/profile.ts <show | expo-env | sam-env | exec-expo -- <cmd>>");
      return 2;
  }
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
