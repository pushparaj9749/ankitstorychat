#!/usr/bin/env bash
# Kissa admin tools for Termux — installs three commands:
#   kp                  → pending ideas/stories dekho
#   kacc idea|story ID  → accept
#   krej idea|story ID  → reject
#
# Usage (Termux):
#   curl -sLo ~/ks.sh <raw url of this file> && bash ~/ks.sh 'YOUR_ADMIN_TOKEN'
#
# The token is NEVER stored in this file or the repo — it is written only to
# ~/.kissa_token on the phone (chmod 600). Running without an argument keeps
# the already-saved token.

BIN="${PREFIX:-/data/data/com.termux/files/usr}/bin"
SHELL_BIN="$BIN/bash"
[ -x "$SHELL_BIN" ] || SHELL_BIN="$(command -v bash)"

if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo "📦 curl + jq install ho rahe hain..."
  pkg install -y curl jq </dev/null || { echo "❌ pkg install fail hua. 'pkg update' chala ke dobara try karo."; exit 1; }
fi

mkdir -p "$BIN"

# ---------- kp ----------
{
  echo "#!$SHELL_BIN"
  cat <<'EOF'
API="${KISSA_API:-https://beyondredeye.site/api/admin}"
if [ ! -s ~/.kissa_token ]; then
  echo "❌ Token save nahi hai. Chalao:  bash ~/ks.sh 'TOKEN'"
  exit 1
fi
RES="$(curl -s -m 20 -H "Authorization: Bearer $(cat ~/.kissa_token)" "$API/pending")"
if [ -z "$RES" ]; then
  echo "❌ Server se jawab nahi aaya (internet check karo)."
  exit 1
fi
echo "$RES" | jq -r '
  if .error then "❌ Error: \(.error)" + (if .error == "unauthorized" then "  (token galat hai)" else "" end) else
  "💡 Ideas: \(.ideas|length)   📖 Stories: \(.stories|length)   (aaj ki limit baaki: \(.remaining))",
  (.ideas[] | "\n💡 IDEA  \(.id)\n   Title  : \(.title)\n   By     : \(.creator.name)\n   Genre  : \(.payload.genre)\n   Concept: \(.payload.concept)\n   Chars  : \(.payload.characters // "-")\n   Notes  : \(.payload.notes // "-")\n   Expires: \(.expiresAt)"),
  (.stories[] | "\n📖 STORY \(.id)\n   Title  : \(.title)\n   By     : \(.creator.name)\n   Genre  : \(.genre // "-")\n   Expires: \(.expiresAt)")
  end' 2>/dev/null || { echo "❌ Ajeeb jawab aaya:"; echo "$RES" | head -c 400; echo; }
EOF
} > "$BIN/kp"

# ---------- kacc / krej ----------
for pair in "kacc:accept" "krej:reject"; do
  name="${pair%%:*}"; action="${pair##*:}"
  {
    echo "#!$SHELL_BIN"
    echo "NAME=$name; ACTION=$action"
    cat <<'EOF'
API="${KISSA_API:-https://beyondredeye.site/api/admin}"
if [ "$1" != "idea" ] && [ "$1" != "story" ] || [ -z "$2" ]; then
  echo "Use:  $NAME idea <ID>    ya    $NAME story <ID>"
  exit 1
fi
if [ ! -s ~/.kissa_token ]; then
  echo "❌ Token save nahi hai. Chalao:  bash ~/ks.sh 'TOKEN'"
  exit 1
fi
RES="$(curl -s -m 20 -X POST -H "Authorization: Bearer $(cat ~/.kissa_token)" "$API/$1/$2/$ACTION")"
if [ -z "$RES" ]; then echo "❌ Server se jawab nahi aaya."; exit 1; fi
echo "$RES" | jq -r 'if .ok then "✅ Done: '"$ACTION"'" else "❌ Error: \(.error)" end' 2>/dev/null || echo "$RES"
EOF
  } > "$BIN/$name"
done

chmod +x "$BIN/kp" "$BIN/kacc" "$BIN/krej"

# ---------- token ----------
if [ -n "$1" ]; then
  printf '%s' "$1" > ~/.kissa_token
  chmod 600 ~/.kissa_token
fi

echo "✅ Commands ready: kp, kacc, krej"
if [ -s ~/.kissa_token ]; then
  echo "✅ Token saved ($(wc -c < ~/.kissa_token | tr -d ' ') characters)"
  echo
  echo "Ab chalao:  kp"
else
  echo "⚠️ Token abhi save nahi hai. Chalao:  bash ~/ks.sh 'TOKEN'"
fi
