# postism

## ローカル開発環境

### 前提

| もの | 用途 | 備考 |
| --- | --- | --- |
| Nix と [devenv](https://devenv.sh/) | 開発ツール一式(bun、tiup、cognito-local、DynamoDB Local、AWS SAM CLI) | `devenv shell` で入る。direnv を使うなら `.envrc` で自動で入る |
| Docker 互換のランタイム(OrbStack など) | `sam local invoke` と `sam local start-api` | Lambda をコンテナで動かすため。起動しておく |
| Xcode と iOS シミュレーター | Expo の iOS 確認 | iOS を確認するときだけ |

### 構成

```
apps/client/      Expo(TypeScript)。1つのコードで Web と iOS(将来 Android も)
apps/api/         AWS SAM(template.yaml)と Lambda(Node.js 24)
scripts/local/    ローカル環境の起動、停止、初期化のスクリプト
sandbox/smoke/    使い捨ての疎通確認アプリ(確認が済んだら削除する)
```

### 起動と停止(ショートカット)

`devenv shell` の中で使う。

| コマンド | すること |
| --- | --- |
| `local-up` | TiDB、DynamoDB Local、cognito-local をバックグラウンドで起動し、準備ができるまで待って、`local-init` を実行する。起動済みなら起動は飛ばす |
| `local-init` | 初期化。cognito-local のユーザープール、アプリクライアント、テストユーザー、DynamoDB のテーブル `postism-local`、TiDB のデータベース `postism` を、無ければ作る。何度実行してもよい |
| `local-status` | 各コンポーネントが応答するかを表示する |
| `local-down` | 止める。データは残る |
| `local-reset` | ローカルのデータを消す(確認あり。`--yes` で確認を飛ばす)。先に `local-down` する |

```sh
devenv shell
bun install       # 初回と、依存を変えたとき(ワークスペース全体)
local-up          # 初回は TiDB のダウンロード(約 200MB)で数分かかる
bun run local:check   # 疎通確認(TiDB、DynamoDB、cognito-local)
local-down
```

`devenv up` を直接使ってもよい(フォアグラウンドで3つを起動する。初期化は別に `local-init` を実行する)。

`local-init` は、作ったプール ID などを `.local/state.json` と `.local/env` に書く(どちらも gitignore 済み)。

### ポート

| コンポーネント | ポート | 備考 |
| --- | --- | --- |
| TiDB(MySQL 互換) | 4000 | `root`、パスワードなし。DB は `postism` |
| TiDB status | 10080 | |
| PD(TiDB Dashboard) | 2379 | http://127.0.0.1:2379/dashboard |
| TiKV | 20160 | |
| DynamoDB Local | 8000 | |
| cognito-local | 9229 | |
| `sam local start-api`(apps/api) | 3000 | |
| `sam local start-api`(sandbox/smoke) | 3001 | |
| Expo Web(apps/client) | 8081 | |
| Expo Web(sandbox/smoke) | 8082 | |

### データの置き場(すべて gitignore 済み)

| もの | 場所 |
| --- | --- |
| TiDB(tiup の本体、コンポーネント、データ) | `.tiup/`(データは `.tiup/data/postism`) |
| DynamoDB Local | `.devenv/state/dynamodb-local` |
| cognito-local | `.cognito/` |
| 初期化の結果 | `.local/` |

### ローカル用の固定値

どれもローカルのエミュレーター用で、秘密ではない。`devenv.nix` と `scripts/local/config.ts` にある。

- AWS の認証情報: `AWS_ACCESS_KEY_ID=local`、`AWS_SECRET_ACCESS_KEY=local`、リージョン `ap-northeast-1`
- テストユーザー: `test@example.com` / `LocalPassw0rd!`(cognito-local の中だけ)

### テスト(apps/api)

```sh
cd apps/api
bun run test          # bun test と vitest の両方
bun run test:bun      # bun test(*.test.ts)
bun run test:vitest   # vitest(*.vitest.ts)
```

- bun test は `*.test.ts` を、vitest は `*.vitest.ts` を対象にする(互いのファイルを拾わないように、名前で分ける)。
- vitest は今は Bun で動く(`bun --bun`、threads プール)。Node では動かしていない。

### AWS SAM(apps/api)

```sh
cd apps/api
bun run invoke        # bun でビルドして sam local invoke
bun run start-api     # bun でビルドして sam local start-api(3000)
curl 'http://127.0.0.1:3000/hello?name=you'
```

- `devenv shell` の中で実行する。外で実行すると、ホストの AWS の設定(プロファイルなど)を読みに行って失敗することがある。
- ビルドは `sam build` ではなく `bun build`(`dist/hello/index.mjs`)。devenv では Node と npm を無効にしているため。

### Expo(apps/client)

```sh
cd apps/client
bun run web           # http://localhost:8081
```

iOS(シミュレーター):

```sh
cd apps/client
bun run ios
```

- devenv は nix の Apple SDK を入れず(`devenv.nix` の `apple.sdk = null`)、システムの Xcode を使う。`devenv shell` の中でも、`xcrun` は `/usr/bin/xcrun` になる。
- 初回は、Expo CLI がシミュレーターに Expo Go を入れる。

### 疎通確認アプリ(sandbox/smoke、使い捨て)

Expo(Web)→ cognito-local でサインイン → Lambda(sam local start-api)→ DynamoDB Local と TiDB に読み書き、を通しで確かめる。

```sh
local-up
# ターミナル 1
cd sandbox/smoke/api && bun run start-api      # 3001
# ターミナル 2
cd sandbox/smoke/client && bun run web         # http://localhost:8082
```

画面で `test@example.com` / `LocalPassw0rd!` を入れてボタンを押すと、API の結果(DynamoDB と TiDB の読み書きの結果)が出る。

### cognito-local で再現できないこと

ローカルで確かめられるのは、ID とパスワードのサインイン(`USER_PASSWORD_AUTH`)、リフレッシュ、トークン(RS256、JWKS)まで。

- ソーシャルサインイン(Apple、Google)と外部 IdP(SAML、OIDC): `CreateIdentityProvider` などが未実装。
- Hosted UI(マネージドログイン)と OAuth2 のエンドポイント(`/oauth2/authorize`、`/oauth2/token`、`/logout`): 無い。ドメイン(`CreateUserPoolDomain`)も未実装。
- `USER_SRP_AUTH`(Amplify の既定)と `CUSTOM_AUTH`: 未対応。ローカルでは `USER_PASSWORD_AUTH` を使う。
- トークンの `iss` は `http://127.0.0.1:9229/<poolId>`(本物は `https://cognito-idp.<region>.amazonaws.com/<poolId>`)。JWKS も http。本物用の検証(aws-jwt-verify の `CognitoJwtVerifier` など)はそのままでは使えない。
- デバイスの記憶、`GlobalSignOut`、高度なセキュリティ(リスク判定)、ユーザーのインポート、リソースサーバー(カスタムスコープ)、UI のカスタマイズ: 未実装。
- MFA は一部のみ。メールや SMS は実際には送らない(コードはログに出る)。
- Lambda トリガーは、設定すれば呼べる(実際の Lambda か、ローカルの Lambda エンドポイント)。今は未設定。
