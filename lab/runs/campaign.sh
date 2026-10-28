#!/usr/bin/env bash
# catch22 next steps campaign: stock control, quant ladder, mini instruct.
# One GPU: every phase stops the previous llama server first.
# Service names are compose service names, container names carry the
# ctch- prefix. Stock serves on 8082, everything else on 8081.
# Logs land in scratch/artifacts/ (gitignored except .gitkeep).
#
#   bash lab/runs/campaign.sh
set -u
cd "$(dirname "$0")/../.."

COMPOSE="docker compose -f docker/compose.yaml"
ART=scratch/artifacts
mkdir -p "$ART"

wait_health() { # $1: port
  for _ in $(seq 1 60); do
    if curl -sf "http://127.0.0.1:$1/health" >/dev/null; then
      echo "server healthy"; return 0
    fi
    sleep 5
  done
  echo "health check timed out"; return 1
}

swap() { # $1: service to stop, $2: service to start, $3: profile, $4: health port
  $COMPOSE stop "$1" >/dev/null 2>&1 || true
  $COMPOSE rm -f "$1" >/dev/null 2>&1 || true
  if [ -n "$3" ]; then
    $COMPOSE --profile "$3" up -d "$2" >/dev/null
  else
    $COMPOSE up -d "$2" >/dev/null
  fi
  wait_health "${4:-8081}" || return 1
  nvidia-smi --query-gpu=memory.used --format=csv,noheader
}

echo "campaign start $(date -Is)"

# ONLY env: comma list to run a subset of phases, default all.
# Useful after partial failures; each phase reuses the durable runner so
# cells already committed are not replayed (same run, resumed).
ONLY="${ONLY:-stock,iq4,q8,mini}"
has() { case ",$ONLY," in *",$1,"*) return 0;; *) return 1;; esac; }

# phase 1: stock control, no tags, 21 cells (port 8082)
if has stock && swap llama-tb llama-stock stock 8082; then
  npm run worker -- run --provider llama --pool datasets/catch22-mode-topics.jsonl \
    --family off --model ctch-stock --maxTokens 3072 \
    2>&1 | tee "$ART/stock-control.log" | tail -3
fi

# phase 2: quant ladder iq4 (subset 10 rows x 12)
if has iq4 && swap llama-stock llama-iq4 iq4; then
  npm run worker -- run --provider llama --pool datasets/subset-quant.jsonl \
    --family reasoning --model ctch-tb-iq4 --maxTokens 3072 \
  2>&1 | tee "$ART/iq4-subset.log" | tail -3
fi

# phase 3: quant ladder q8 (same subset)
if has q8 && swap llama-iq4 llama-q8 q8; then
  npm run worker -- run --provider llama --pool datasets/subset-quant.jsonl \
    --family reasoning --model ctch-tb-q8 --maxTokens 3072 \
    2>&1 | tee "$ART/q8-subset.log" | tail -3
fi

# phase 4: 2.6B mini instruct contrast (full pool, real instruct family)
if has mini && swap llama-q8 llama-mini mini; then
  npm run worker -- run --provider llama --pool datasets/catch22-mode-topics.jsonl \
    --family instruct --model ctch-mini --maxTokens 3072 \
    2>&1 | tee "$ART/mini-instruct.log" | tail -3
fi

# phase 5: polite default restore (stop every lab server by name first,
# so no port 8081 holder survives the swap race)
docker stop ctch-llama-mini ctch-llama-tb-iq4 ctch-llama-tb-q8 ctch-llama-stock \
  >/dev/null 2>&1 || true
docker rm -f ctch-llama-mini ctch-llama-tb-iq4 ctch-llama-tb-q8 ctch-llama-stock \
  >/dev/null 2>&1 || true
$COMPOSE up -d llama-tb >/dev/null
echo "campaign done $(date -Is)"
