#!/bin/bash
# Setup script for backend environment
# Run once after cloning: bash backend/setup.sh

set -e

ENV_FILE="$(dirname "$0")/.env"
EXAMPLE_FILE="$(dirname "$0")/.env.example"

echo "=== Clevai Audit System - Backend Setup ==="
echo ""

if [ -f "$ENV_FILE" ]; then
  echo ".env already exists. Overwrite? (y/N)"
  read -r answer
  if [ "$answer" != "y" ] && [ "$answer" != "Y" ]; then
    echo "Skipped."
    exit 0
  fi
fi

cp "$EXAMPLE_FILE" "$ENV_FILE"

# --- DB Password ---
echo "Enter DB_PASSWORD (ask your team lead if you don't have it):"
read -r -s db_password
echo ""

if [ -n "$db_password" ]; then
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$db_password/" "$ENV_FILE"
  echo "[OK] DB password set."
else
  echo "[WARN] DB_PASSWORD is empty. Backend will run in dev-only mode."
fi

# --- Generate random JWT secrets ---
generate_secret() {
  # Use openssl if available, fallback to /dev/urandom
  if command -v openssl &> /dev/null; then
    openssl rand -hex 32
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1
  fi
}

JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)

sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$ENV_FILE"
sed -i "s/^JWT_REFRESH_SECRET=.*/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" "$ENV_FILE"
echo "[OK] JWT secrets generated (unique to this machine)."

# --- Summary ---
echo ""
echo "Setup complete! Your .env file is ready at: $ENV_FILE"
echo ""
echo "Next steps:"
echo "  cd backend && npm install && npm run dev"
echo ""
echo "Note: .env is gitignored - your credentials stay local."
