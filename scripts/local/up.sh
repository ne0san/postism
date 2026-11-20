#!/usr/bin/env bash
# ローカルの TiDB、DynamoDB Local、cognito-local をバックグラウンドで起動し、初期化する。
# 何度実行しても壊れない(起動済みなら起動を飛ばし、初期化は「無ければ作る」)。
set -euo pipefail
cd "$DEVENV_ROOT"
bash "$DEVENV_ROOT/scripts/local/tiup-bootstrap.sh"
if devenv processes list >/dev/null 2>&1; then
  echo "processes are already running"
else
  devenv up --detach --strict-ports
fi
echo "waiting for processes to be ready..."
devenv processes wait
bun "$DEVENV_ROOT/scripts/local/init.ts"
bash "$DEVENV_ROOT/scripts/local/status.sh"
