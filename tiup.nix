{
  lib,
  buildGoModule,
  fetchFromGitHub,
}:
buildGoModule rec {
  pname = "tiup";
  version = "1.17.1";

  src = fetchFromGitHub {
    owner = "pingcap";
    repo = "tiup";
    rev = "v${version}";
    hash = "sha256-yd7EEiudQwpp9BNcJ8/uIbDX8Db45gGGhh/NzAc6p9U=";
  };

  vendorHash = "sha256-GvZxzUu/jH3pFy1xIxQceFcBoWqqJhsj+ORUyUvmDtk=";

  env.CGO_ENABLED = 0;

  ldflags = [
    "-s"
    "-w"
    "-X github.com/pingcap/tiup/pkg/version.GitHash=v${version}"
    "-X github.com/pingcap/tiup/pkg/version.GitRef=v${version}"
  ];

  doCheck = false;

  meta = {
    description = "Component manager for TiDB";
    homepage = "https://github.com/pingcap/tiup";
    license = lib.licenses.asl20;
    mainProgram = "tiup";
  };
}
