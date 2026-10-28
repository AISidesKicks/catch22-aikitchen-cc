#!/usr/bin/env bash
# catch22 next steps campaign: stock control, quant ladder, mini instruct.
# One GPU: every phase stops the previous llama server first.
# Logs land in scratch/artifacts/ (gitignored except .gitkeep).
#
#   bash lab/runs/campaign.sh
set -u
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f docker/compose.yaml"
ART=scratch/artifacts
mkdir -p "$ART"

wait_health() {
  for _ in $(seq 1 60); do
    if curl -sf http://127.0.0.1:8081/health >/dev/null; then
      echo "server healthy"; return 0
    fi
    sleep 5
  done
  echo "health check timed out"; return 1
}

swap() { # $1: service to stop, $2: service to start, $3: profile
  $COMPOSE stop "$1" >/dev/null 2>&1 || true
  $COMPOSE rm -f "$1" >/dev/null 2>&1 || true
  if [ -n "$3" ]; then
    $COMPOSE --profile "$3" up -d "$2" >/dev/null
  else
    $COMPOSE up -d "$2" >/dev/null
  fi
  wait_health || return 1
  nvidia-smi --query-gpu=memory.used --format=csv,noheader
}

run_worker() { # unused helper kept for ad hoc reruns
  local label="$1"; shift
  echo "=== $label ==="
  CATCH22_TRACE_MODEL="$label" npm run worker -- "$@"
}

echo "campaign start $(date -Is)"

# phase 1: stock control, no tags, 21 cells
if swap llama-tb llama-stock stock; then
  npm run worker -- run --pool datasets/catch22-mode-topics.jsonl \
    --family off --model ctch-stock --maxTokens 3072 \
    2>&1 | tee "$ART/stock-control.log" | tail -3
fi

# phase 2: quant ladder iq4 (subset 10 rows x 12)
if swap llama-stock llama-tb-iq4 iq4; then
  npm run worker -- run --pool datasets/subset-quant.jsonl \
    --family reasoning --model ctch-tb-iq4 --maxTokens 3072 \
    2>&1 | tee "$ART/iq4-subset.log" | tail -3
fi

# phase 3: quant ladder q8 (same subset)
if swap llama-tb-iq4 llama-tb-q8 q8; then
  npm run worker -- run --pool datasets/subset-quant.jsonl \
    --family reasoning --model ctch-tb-q8 --maxTokens 3072 \
    2>&1 | tee "$ART/q8-subset.log" | tail -3
fi

# phase 4: 2.6B mini instruct contrast (full pool, real instruct family)
if swap llama-tb-q8 llama-mini mini; then
  npm run worker -- run --pool datasets/catch22-mode-topics.jsonl \
    --family instruct --model ctch-mini --maxTokens 3072 \
    2>&1 | tee "$ART/mini-instruct.log" | tail -3
fi

# phase 5: polite default restore
$COMPOSE --profile mini stop llama-mini >/dev/null 2>&1 || true
$COMPOSE --profile mini rm -f llama-mini >/dev/null 2>&1 || true
$COMPOSE up -d llama-tb >/dev/null
echo "campaign done $(date -Is)"
