{
  pkgs,
  lib,
  config,
  ...
}: let
  root = config.devenv.root;
  tidbVersion = "v8.5.8";
in {
  # https://devenv.sh/packages/
  packages = with pkgs;
    [
      aws-sam-cli
      bun
      curl
      (callPackage ./tiup.nix {})
      (callPackage ./cognito-local.nix {})
    ]
    # iOS の開発ビルド(bunx expo run:ios)用。Linux(CI)では入れない。
    ++ lib.optionals stdenv.isDarwin [cocoapods];

  # nix の Apple SDK を入れず、システムの Xcode を使う。
  # 既定の SDK は DEVELOPER_DIR と SDKROOT を書き換え、Xcode を知らない簡易版の xcrun(xcbuild)を
  # PATH の先に置くため、Expo(xcrun simctl)が iOS シミュレーターを操作できない。
  apple.sdk = null;

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      enable = true;
      # Lambda の実ランタイム(nodejs24.x)と同じ Node 24。vitest はこれで動かす。npm は入れない(bun を使う)。
      package = pkgs.nodejs-slim_24;
      nodejs.enable = true;
      bun.enable = true;
    };
    typescript.enable = true;
  };

  # ローカル専用の固定値。秘密ではない(エミュレーターは値を検証しない)。
  env = {
    TIUP_HOME = "${root}/.tiup";
    LOCAL_TIDB_VERSION = tidbVersion;
    AWS_ACCESS_KEY_ID = "local";
    AWS_SECRET_ACCESS_KEY = "local";
    AWS_REGION = "ap-northeast-1";
    AWS_DEFAULT_REGION = "ap-northeast-1";
    LOCAL_DYNAMODB_ENDPOINT = "http://127.0.0.1:8000";
    LOCAL_COGNITO_ENDPOINT = "http://127.0.0.1:9229";
    LOCAL_TIDB_HOST = "127.0.0.1";
    LOCAL_TIDB_PORT = "4000";
  };

  # DynamoDB Local。既定は 8000。データは .devenv/state/dynamodb-local。
  services.dynamodb-local.enable = true;

  # cognito-local。既定は 9229。データは <root>/.cognito。
  processes.cognito-local = {
    exec = "cognito-local";
    cwd = root;
    # 既定の localhost だと ::1(IPv6)だけで待ち受ける。IPv4 に揃える。
    # トークンの iss も http://127.0.0.1:9229/<poolId> になる。
    env = {
      HOST = "127.0.0.1";
      PORT = "9229";
    };
    ready.http.get = {
      port = 9229;
      path = "/health";
    };
  };

  # TiDB(tiup playground)。MySQL 互換は 4000。データは $TIUP_HOME/data/postism。
  processes.tidb = {
    exec = ''
      ${root}/scripts/local/tiup-bootstrap.sh
      exec tiup playground ${tidbVersion} \
        --tag postism \
        --without-monitor \
        --tiflash 0 \
        --db.port 4000
    '';
    cwd = root;
    ready = {
      http.get = {
        port = 10080;
        path = "/status";
      };
      initial_delay = 5;
    };
  };

  # devenv shell の中で使うショートカット。使い方は README を参照。
  scripts = {
    local-up.exec = ''exec bash "${root}/scripts/local/up.sh" "$@"'';
    local-down.exec = ''exec bash "${root}/scripts/local/down.sh" "$@"'';
    local-init.exec = ''exec bun "${root}/scripts/local/init.ts" "$@"'';
    local-status.exec = ''exec bash "${root}/scripts/local/status.sh" "$@"'';
    local-reset.exec = ''exec bash "${root}/scripts/local/reset.sh" "$@"'';
  };

  # See full reference at https://devenv.sh/reference/options/
}
