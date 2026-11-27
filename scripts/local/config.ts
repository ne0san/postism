// ローカル環境の固定値。どれもローカルのエミュレーター用で、秘密ではない。
// 本番や開発環境の値は、ここに書かない。
import type {
  CreateUserPoolClientRequest,
  CreateUserPoolRequest,
} from "@aws-sdk/client-cognito-identity-provider";

export const LOCAL = {
  cognitoEndpoint: process.env.LOCAL_COGNITO_ENDPOINT ?? "http://127.0.0.1:9229",
  dynamodbEndpoint: process.env.LOCAL_DYNAMODB_ENDPOINT ?? "http://127.0.0.1:8000",
  tidbHost: process.env.LOCAL_TIDB_HOST ?? "127.0.0.1",
  tidbPort: Number(process.env.LOCAL_TIDB_PORT ?? 4000),
  tidbDatabase: "postism",
  tableName: "postism-local",
  userPoolName: "postism-local",
  clientName: "postism-local-client",
  /** MFA なしのユーザー(smoke と、MFA を使わない確認用)。 */
  testUser: {
    username: "test@example.com",
    password: "LocalPassw0rd!",
  },
  /** TOTP を登録済みのユーザー(ログインの確認用)。TOTP のシークレットは .local/state.json に書く。 */
  mfaUser: {
    username: "mfa@example.com",
    password: "LocalPassw0rd!",
  },
} as const;

/**
 * ログイン用のユーザープールの設定(2026-11-26 に決定)。dev と本番も同じ値にする。違いは MFA だけ:
 * ローカルは OPTIONAL(cognito-local が MFA_SETUP に対応しないため。アプリの側で登録を強制する)、
 * dev と本番は ON。
 * cognito-local は、パスワードの規則と、大文字と小文字を区別しない設定を、保存はするが効かせない。
 */
export const USER_POOL_SETTINGS = {
  UsernameAttributes: ["email"],
  UsernameConfiguration: { CaseSensitive: false },
  AutoVerifiedAttributes: ["email"],
  AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
  Policies: {
    PasswordPolicy: {
      MinimumLength: 12,
      RequireLowercase: false,
      RequireUppercase: false,
      RequireNumbers: false,
      RequireSymbols: false,
      TemporaryPasswordValidityDays: 7,
    },
  },
  MfaConfiguration: "OPTIONAL",
  AccountRecoverySetting: {
    RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }],
  },
} as const satisfies Omit<CreateUserPoolRequest, "PoolName">;

/** iOS 用(シークレットなし)のアプリクライアントの設定。USER_PASSWORD_AUTH はローカルだけ許可する。 */
export const APP_CLIENT_SETTINGS = {
  GenerateSecret: false,
  ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  PreventUserExistenceErrors: "ENABLED",
  AccessTokenValidity: 60,
  IdTokenValidity: 60,
  RefreshTokenValidity: 30,
  TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "days" },
} as const satisfies Omit<CreateUserPoolClientRequest, "UserPoolId" | "ClientName">;
