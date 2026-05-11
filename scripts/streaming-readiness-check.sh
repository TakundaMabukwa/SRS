#!/usr/bin/env bash
set -u

# Usage:
#   bash scripts/streaming-readiness-check.sh
# Optional env overrides:
#   LISTENER_BASE_URL=http://209.38.206.44:3000 \
#   HUB_BASE_URL=http://169.239.180.72:3215 \
#   SRS_BASE_URL=http://127.0.0.1:3000 \
#   TEST_SIM=221085851136 \
#   TEST_CHANNEL=1 \
#   bash scripts/streaming-readiness-check.sh

LISTENER_BASE_URL="${LISTENER_BASE_URL:-http://209.38.206.44:3000}"
HUB_BASE_URL="${HUB_BASE_URL:-http://169.239.180.72:3215}"
SRS_BASE_URL="${SRS_BASE_URL:-http://127.0.0.1:3000}"
TEST_SIM="${TEST_SIM:-221085851136}"
TEST_CHANNEL="${TEST_CHANNEL:-1}"

PASS_COUNT=0
FAIL_COUNT=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

check_http() {
  local name="$1"
  local method="$2"
  local url="$3"
  local body="${4:-}"

  local code
  if [[ "$method" == "POST" ]]; then
    code="$(curl -sS -o /tmp/srs_check_body.$$ -w "%{http_code}" \
      -X POST "$url" -H "Content-Type: application/json" -d "$body" || true)"
  else
    code="$(curl -sS -o /tmp/srs_check_body.$$ -w "%{http_code}" "$url" || true)"
  fi

  if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
    green "[PASS] $name :: HTTP $code"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    red "[FAIL] $name :: HTTP $code"
    yellow "       url=$url"
    if [[ -s /tmp/srs_check_body.$$ ]]; then
      head -c 240 /tmp/srs_check_body.$$ | tr '\n' ' ' | sed 's/$/\n/'
    fi
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

check_header_only() {
  local name="$1"
  local url="$2"
  local headers
  headers="$(curl -sS -D - --max-time 8 "$url" -o /dev/null || true)"
  if echo "$headers" | grep -q "HTTP/.* 200"; then
    green "[PASS] $name :: HTTP 200"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    red "[FAIL] $name :: no HTTP 200"
    yellow "       url=$url"
    echo "$headers" | head -n 12
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "Streaming readiness check"
echo "listener=$LISTENER_BASE_URL"
echo "hub=$HUB_BASE_URL"
echo "srs=$SRS_BASE_URL"
echo "testSim=$TEST_SIM ch=$TEST_CHANNEL"
echo

check_http "listener connected vehicles" "GET" \
  "$LISTENER_BASE_URL/api/vehicles/connected"

check_http "listener start-live" "POST" \
  "$LISTENER_BASE_URL/api/vehicles/$TEST_SIM/start-live" \
  "{\"channel\":$TEST_CHANNEL}"

check_http "hub live vehicles" "GET" \
  "$HUB_BASE_URL/api/live/vehicles"

check_http "hub latest screenshots" "GET" \
  "$HUB_BASE_URL/api/live/screenshots/latest"

check_header_only "hub live mjpeg endpoint" \
  "$HUB_BASE_URL/api/live/mjpeg?sim=$TEST_SIM&channel=$TEST_CHANNEL&autoStart=true&videoOnly=true&input=auto&fps=8"

check_http "srs proxy live ready" "GET" \
  "$SRS_BASE_URL/api/video-server/live/ready?sim=$TEST_SIM&channel=$TEST_CHANNEL&maxAgeMs=20000"

check_http "srs proxy alerts active" "GET" \
  "$SRS_BASE_URL/api/video-server/alerts?status=new&limit=10"

echo
echo "Summary: pass=$PASS_COUNT fail=$FAIL_COUNT"
if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
