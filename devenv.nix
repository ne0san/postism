{
  pkgs,
  lib,
  config,
  ...
}:
{
  # https://devenv.sh/packages/
  packages = [ pkgs.aws-sam-cli ];

  # https://devenv.sh/languages/
  languages = {
    javascript = {
      nodejs.enable = false;
      bun.enable = true;
    };
    typescript.enable = true;
  };

  # See full reference at https://devenv.sh/reference/options/
}
