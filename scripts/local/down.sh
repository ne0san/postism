#!/usr/bin/env bash
# local-up で起動したプロセスを止める。データは残す。
set -euo pipefail
cd "$DEVENV_ROOT"
devenv processes down
