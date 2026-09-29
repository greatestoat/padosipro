#!/usr/bin/env bash
# Runs the full user journey against a locally running API and Mailpit.
# Usage (from backend/):  bash scripts/walkthrough.sh
# Requires: curl, jq. The API (npm run dev) and Docker services must be running.
set -euo pipefail

API="${API:-http://localhost:4000/api}"
MAILPIT="${MAILPIT:-http://localhost:8025}"
EMAIL="demo+$(date +%s)@example.com"   # unique per run, so re-running never conflicts
PASSWORD="Passw0rd123"

command -v jq >/dev/null || { echo "jq is required (https://jqlang.github.io/jq/)" >&2; exit 1; }

AUTH=()   # becomes (-H "Authorization: Bearer <token>") after login

call() {
  local method=$1 path=$2 body=${3:-}
  local args=(-s -X "$method" "$API$path" -H "Content-Type: application/json")
  [ ${#AUTH[@]} -gt 0 ] && args+=("${AUTH[@]}")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}"
}

step() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# Reads the newest OTP email for $EMAIL from Mailpit's API.
get_code() {
  local id=""
  for _ in 1 2 3 4 5; do
    id=$(curl -s -G "$MAILPIT/api/v1/search" --data-urlencode "query=to:$EMAIL" \
      | jq -r '.messages[0].ID // empty')
    [ -n "$id" ] && break
    sleep 1
  done
  [ -n "$id" ] || { echo "No OTP email found in Mailpit" >&2; exit 1; }
  curl -s "$MAILPIT/api/v1/message/$id" | jq -r '.Text' | grep -oE '[0-9]{6}' | head -n1
}

step "1. Health"
call GET /health | jq .

step "2. Register $EMAIL"
call POST /auth/register \
  "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"confirmPassword\":\"$PASSWORD\"}" | jq .

step "3. Login before verifying (expect EMAIL_NOT_VERIFIED)"
call POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq .

CODE=$(get_code)
echo; echo "OTP read from Mailpit: $CODE"

step "4. Verify with a wrong code (expect OTP_INVALID)"
WRONG="000000"; [ "$CODE" = "$WRONG" ] && WRONG="111111"
call POST /auth/verify-otp "{\"email\":\"$EMAIL\",\"otp\":\"$WRONG\"}" | jq .

step "5. Verify with the correct code"
call POST /auth/verify-otp "{\"email\":\"$EMAIL\",\"otp\":\"$CODE\"}" | jq .

step "6. Login"
LOGIN=$(call POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN" | jq '.data.token |= (.[0:20] + "...")'
TOKEN=$(echo "$LOGIN" | jq -r '.data.token')
AUTH=(-H "Authorization: Bearer $TOKEN")

step "7. Profile is empty on first login"
call GET /profile | jq .

step "8. Invalid profile (expect VALIDATION_ERROR)"
call PUT /profile '{"name":"A","mobileNumber":"12345","address":"x"}' | jq .

step "9. Save profile (business name omitted, number normalised to +91)"
call PUT /profile \
  '{"name":"Test User","mobileNumber":"98765 43210","address":"12 Test Street, Hyderabad"}' | jq .

step "10. Categories and tasks"
call GET /tasks/categories | jq -c '.data.categories'
call GET "/tasks?category=Vehicle" | jq -c '.data.tasks | map(.name)'

step "11. Select the first two tasks"
IDS=$(call GET /tasks | jq -c '[.data.tasks[0].id, .data.tasks[1].id]')
call PUT /user/tasks "{\"taskIds\":$IDS}" | jq .

step "12. Home: selected tasks"
call GET /user/tasks | jq -c '.data.tasks | map(.name)'

step "13. Login again: routing flags are now true"
call POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq '.data.user'

step "14. Logout"
call POST /auth/logout | jq .

printf '\n\033[1mWalkthrough complete for %s\033[0m\n' "$EMAIL"