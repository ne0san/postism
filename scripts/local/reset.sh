#!/usr/bin/env bash
# ローカルのデータを消す。プロセスは先に local-down で止めておくこと。
set -euo pipefail
cd "$DEVENV_ROOT"
targets=(".tiup/data/postism" ".cognito" ".devenv/state/dynamodb-local" ".local")
echo "次を削除します:"; printf '  %s\n' "${targets[@]}"
if [ "${1:-}" != "--yes" ]; then
  read -r -p "よろしいですか? [y/N] " ans
  [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { echo "中止しました"; exit 1; }
fi
rm -rf "${targets[@]}"
echo "削除しました。次は local-up で起動し直してください。"
