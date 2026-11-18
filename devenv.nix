{pkgs, ...}: {
  # https://devenv.sh/packages/
  packages = with pkgs; [
    aws-sam-cli
    bun
    (callPackage ./tiup.nix {})
    (callPackage ./cognito-local.nix {})
  ];

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      nodejs.enable = false;
      bun.enable = true;
    };
    typescript.enable = true;
  };

  services.dynamodb-local.enable = true; # デフォルトは8000
  processes.cognito-local.exec = "cognito-local"; # デフォルトは9229

  # See full reference at https://devenv.sh/reference/options/
}
