{
  lib,
  stdenv,
  fetchFromGitHub,
  fetchYarnDeps,
  yarnConfigHook,
  yarnBuildHook,
  yarnInstallHook,
  nodejs,
}:
stdenv.mkDerivation (finalAttrs: {
  pname = "cognito-local";
  version = "5.3.0"; # 使いたいタグに置き換え

  src = fetchFromGitHub {
    owner = "jagregory";
    repo = "cognito-local";
    rev = "v${finalAttrs.version}"; # タグ名の形式は要確認
    hash = "sha256-NBoRs7d0DzNh053qDY8dCMgeQ/LRVnBpprk437nAKQo=";
  };

  offlineCache = fetchYarnDeps {
    yarnLock = "${finalAttrs.src}/yarn.lock";
    hash = "sha256-6W97PWXFRXaI0p12TgtL/fA9ggVhO7rPWiPSexSlTnQ=";
  };

  nativeBuildInputs = [yarnConfigHook yarnBuildHook yarnInstallHook nodejs];

  meta = {
    description = "Offline emulator for Amazon Cognito";
    homepage = "https://github.com/jagregory/cognito-local";
    license = lib.licenses.mit;
    mainProgram = "cognito-local";
  };
})
