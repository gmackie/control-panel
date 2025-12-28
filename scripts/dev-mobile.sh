#!/bin/bash
# Development script for mobile app with ngrok tunnel for API
# Expo handles its own tunnel via --tunnel flag

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Temp files
NEXT_LOG="/tmp/control-panel-next.log"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GMAC Control Panel Mobile Development${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check for ngrok
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}Error: ngrok is not installed${NC}"
    echo ""
    echo "Install ngrok:"
    echo "  brew install ngrok    # macOS"
    echo "  npm install -g ngrok  # or via npm"
    echo ""
    echo "Then authenticate with: ngrok authtoken YOUR_TOKEN"
    echo "Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken"
    exit 1
fi

# Check for jq (used for parsing JSON)
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo ""
    echo "Install jq:"
    echo "  brew install jq    # macOS"
    exit 1
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    
    # Kill background processes
    [ -n "$NEXT_PID" ] && kill $NEXT_PID 2>/dev/null || true
    [ -n "$NGROK_PID" ] && kill $NGROK_PID 2>/dev/null || true
    
    # Clean up temp files
    rm -f "$NEXT_LOG"
    
    echo -e "${GREEN}Goodbye!${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Function to extract port from Next.js output
get_next_port() {
    grep -oE 'Local:[[:space:]]*http://localhost:[0-9]+' "$NEXT_LOG" 2>/dev/null | grep -oE '[0-9]+$' | head -1
}

# ============================================
# Step 1: Start Next.js and get its port
# ============================================
echo -e "${YELLOW}[1/3] Starting Next.js server...${NC}"
> "$NEXT_LOG"
pnpm --filter @repo/web dev > "$NEXT_LOG" 2>&1 &
NEXT_PID=$!

echo -e "      Waiting for Next.js to be ready..."
NEXT_PORT=""
for i in {1..60}; do
    NEXT_PORT=$(get_next_port)
    if [ -n "$NEXT_PORT" ]; then
        break
    fi
    sleep 1
done

if [ -z "$NEXT_PORT" ]; then
    echo -e "${RED}Error: Could not detect Next.js port after 60 seconds${NC}"
    echo "Last log output:"
    tail -20 "$NEXT_LOG"
    exit 1
fi

echo -e "${GREEN}      Next.js running on port ${NEXT_PORT}${NC}"

# ============================================
# Step 2: Start ngrok tunnel for API
# ============================================
echo -e "${YELLOW}[2/3] Starting ngrok tunnel for API...${NC}"

NGROK_LOG="/tmp/ngrok-control-panel-$$.log"
NGROK_URL="https://control-panel.ngrok.app"

# Start ngrok with static domain
ngrok http "$NEXT_PORT" --url="$NGROK_URL" --log=stdout --log-level=info > "$NGROK_LOG" 2>&1 &
NGROK_PID=$!

echo -e "      Waiting for ngrok tunnel..."
API_URL=""
for i in {1..20}; do
    # Check if tunnel is established by looking for success in logs
    if grep -q "started tunnel" "$NGROK_LOG" 2>/dev/null || grep -q "client session established" "$NGROK_LOG" 2>/dev/null; then
        # Verify tunnel is actually working
        if curl -s --head "$NGROK_URL" >/dev/null 2>&1; then
            API_URL="$NGROK_URL"
            break
        fi
    fi
    
    # Check for errors
    if grep -q "ERR_NGROK" "$NGROK_LOG" 2>/dev/null; then
        echo -e "${RED}Error: ngrok failed to start${NC}"
        tail -20 "$NGROK_LOG"
        exit 1
    fi
    
    sleep 1
done

if [ -z "$API_URL" ]; then
    echo -e "${RED}Error: Could not establish ngrok tunnel${NC}"
    echo "Ngrok log:"
    tail -20 "$NGROK_LOG"
    exit 1
fi

echo -e "${GREEN}      API tunnel: ${API_URL}${NC}"

# ============================================
# Step 3: Start Expo with API URL and tunnel
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Development environment ready!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Next.js:${NC}      http://localhost:${NEXT_PORT}"
echo -e "${BLUE}API tunnel:${NC}   ${API_URL}"
echo -e "${BLUE}tRPC:${NC}         ${API_URL}/api/trpc"
echo ""
echo -e "${YELLOW}[3/3] Starting Expo development client...${NC}"
echo -e "      EXPO_PUBLIC_API_URL=${API_URL}"
echo -e "      APP_VARIANT=development"
echo ""
echo -e "${YELLOW}Make sure you have a development build installed:${NC}"
echo -e "      eas build --profile development --platform ios"
echo -e "      eas build --profile development --platform android"
echo ""
echo -e "${YELLOW}Scan the QR code with your phone camera to open in dev client${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Run Expo in foreground with the API URL and dev client
cd apps/mobile
APP_VARIANT=development EXPO_PUBLIC_API_URL="$API_URL" npx expo start --dev-client --tunnel
