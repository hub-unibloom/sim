#!/bin/bash

# setup-env.sh
# Script to setup secure environment variables for SimStudio

set -e

# ANSI color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== SimStudio Secure Setup ===${NC}"

# Check if .env files exist, if not create them from example
if [ ! -f "apps/sim/.env" ]; then
    echo -e "${YELLOW}Creating apps/sim/.env from example...${NC}"
    if [ -f "apps/sim/.env.example" ]; then
        cp apps/sim/.env.example apps/sim/.env
    else
        echo -e "${RED}Error: apps/sim/.env.example not found!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}apps/sim/.env already exists.${NC}"
fi

# Function to generate a random hex string
generate_secret() {
    openssl rand -hex 32
}

# Function to update or add a variable in .env file
# Usage: update_env "VAR_NAME" "VALUE" "FILE_PATH"
update_env() {
    local key=$1
    local value=$2
    local file=$3

    # Escape special characters in value for sed
    # We use | as delimiter for sed s///
    # So we need to escape | in value
    local escaped_value=$(echo "$value" | sed 's/|/\\|/g')

    if grep -q "^$key=" "$file"; then
        sed -i "s|^$key=.*|$key=$escaped_value|" "$file"
    else
        echo "$key=$escaped_value" >> "$file"
    fi
}

echo -e "${GREEN}Generating secure keys...${NC}"

# Generate secrets
BETTER_AUTH_SECRET=$(generate_secret)
ENCRYPTION_KEY=$(generate_secret)
INTERNAL_API_SECRET=$(generate_secret)
API_ENCRYPTION_KEY=$(generate_secret)

# Ask for database credentials or generate them
echo -e "${YELLOW}Database Configuration:${NC}"
read -p "Enter Database User (default: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -s -p "Enter Database Password (leave empty to generate secure random): " DB_PASS
echo
if [ -z "$DB_PASS" ]; then
    DB_PASS=$(openssl rand -base64 24) # Strong DB password
    echo -e "${GREEN}Generated database password.${NC}"
fi

read -p "Enter Database Name (default: simstudio): " DB_NAME
DB_NAME=${DB_NAME:-simstudio}

# Update apps/sim/.env
ENV_FILE="apps/sim/.env"

update_env "BETTER_AUTH_SECRET" "$BETTER_AUTH_SECRET" "$ENV_FILE"
update_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY" "$ENV_FILE"
update_env "INTERNAL_API_SECRET" "$INTERNAL_API_SECRET" "$ENV_FILE"
update_env "API_ENCRYPTION_KEY" "$API_ENCRYPTION_KEY" "$ENV_FILE"

# PostgreSQL URL construction
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
update_env "DATABASE_URL" "$DATABASE_URL" "$ENV_FILE"


# Also create a .env for docker-compose based on these values
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating root .env for Docker Compose...${NC}"
    touch .env
fi

ROOT_ENV=".env"
update_env "POSTGRES_USER" "$DB_USER" "$ROOT_ENV"
update_env "POSTGRES_PASSWORD" "$DB_PASS" "$ROOT_ENV"
update_env "POSTGRES_DB" "$DB_NAME" "$ROOT_ENV"

# Pass the same secrets to root .env
update_env "BETTER_AUTH_SECRET" "$BETTER_AUTH_SECRET" "$ROOT_ENV"
update_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY" "$ROOT_ENV"
update_env "INTERNAL_API_SECRET" "$INTERNAL_API_SECRET" "$ROOT_ENV"
update_env "API_ENCRYPTION_KEY" "$API_ENCRYPTION_KEY" "$ROOT_ENV"

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo -e "Secrets generated and saved to ${YELLOW}apps/sim/.env${NC} and ${YELLOW}.env${NC}"
echo -e "Database Password: ${YELLOW}HIDDEN IN FILE${NC}"
echo -e "${GREEN}You can now run 'docker compose -f docker-compose.prod.yml up -d'${NC}"
