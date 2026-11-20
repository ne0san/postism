#!/usr/bin/env bash
# 各コンポーネントのポートが開いているかを表示する。
set -uo pipefail
check() {
  local name=$1 url=$2
  if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
    printf '  %-14s up    %s\n' "$name" "$url"
  else
    printf '  %-14s down  %s\n' "$name" "$url"
  fi
}
echo "local services:"
check tidb          "http://127.0.0.1:10080/status"
# DynamoDB Local は GET / に 400 を返すので、ポートの接続だけを見る。
if curl -sS -o /dev/null --max-time 2 "http://127.0.0.1:8000/" 2>/dev/null; then
  printf '  %-14s up    %s\n' dynamodb "http://127.0.0.1:8000"
else
  printf '  %-14s down  %s\n' dynamodb "http://127.0.0.1:8000"
fi
check cognito-local "http://127.0.0.1:9229/health"
echo "  (TiDB の MySQL 互換ポートは 127.0.0.1:4000、user root、パスワードなし)"
