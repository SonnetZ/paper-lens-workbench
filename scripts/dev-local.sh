#!/usr/bin/env bash
set -euo pipefail

device="${1:-cpu}"
if [[ "$device" != "cpu" && "$device" != "gpu" ]]; then
  echo "Usage: npm run dev:local:cpu|dev:local:gpu"
  exit 2
fi

mkdir -p logs

start() {
  local name="$1"
  shift
  nohup "$@" > "logs/${name}.log" 2>&1 &
  echo "$!" > "logs/${name}.pid"
  echo "${name}: pid $(cat "logs/${name}.pid"), log logs/${name}.log"
}

start translate-opus npm run translate:opus
start "embed-bge-m3-${device}" npm run "embed:bge-m3:${device}"
start web-3000 env \
  TRANSLATION_OPUS_BASE_URL="${TRANSLATION_OPUS_BASE_URL:-http://127.0.0.1:8010}" \
  RETRIEVAL_EMBEDDING_BASE_URL="${RETRIEVAL_EMBEDDING_BASE_URL:-http://127.0.0.1:8090/v1}" \
  RETRIEVAL_EMBEDDING_MODEL="${RETRIEVAL_EMBEDDING_MODEL:-BAAI/bge-m3}" \
  npm run dev -- -p "${PORT:-3000}"

echo "Stop with: kill \$(cat logs/translate-opus.pid logs/embed-bge-m3-${device}.pid logs/web-3000.pid)"
