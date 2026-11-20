#!/usr/bin/env bash
# TiDB(tiup playground)を起動する前の準備。何度実行しても同じ結果になる。
# 1. tiup を nix でビルドすると、公式インストーラーが置く root.json(ミラーの信頼の起点)が無い。
#    無いときだけ公式ミラーから取得する。
# 2. 初回は TiDB の各コンポーネント(約 200MB)をダウンロードする。プロセスの起動前に済ませる。
set -euo pipefail
: "${TIUP_HOME:?TIUP_HOME is not set (devenv shell の中で実行してください)}"
: "${LOCAL_TIDB_VERSION:?LOCAL_TIDB_VERSION is not set}"
mirror="https://tiup-mirrors.pingcap.com"
if [ ! -s "$TIUP_HOME/bin/root.json" ]; then
  mkdir -p "$TIUP_HOME/bin"
  echo "tiup: fetching root.json from $mirror"
  curl -fsSL "$mirror/root.json" -o "$TIUP_HOME/bin/root.json"
fi
for c in playground "pd:$LOCAL_TIDB_VERSION" "tikv:$LOCAL_TIDB_VERSION" "tidb:$LOCAL_TIDB_VERSION"; do
  name=${c%%:*}
  if [ "$c" = playground ]; then
    ls "$TIUP_HOME/components/playground" >/dev/null 2>&1 && continue
  else
    [ -d "$TIUP_HOME/components/$name/$LOCAL_TIDB_VERSION" ] && continue
  fi
  echo "tiup: installing $c"
  tiup install "$c"
done
