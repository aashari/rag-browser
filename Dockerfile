FROM oven/bun:1 as builder

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Install Playwright browsers
RUN bunx playwright install chromium

# Build TypeScript
RUN bun run build

# Create a non-root user
RUN useradd -m mcp
USER mcp

# Set environment variables
ENV NODE_ENV=production
ENV HEADLESS=false
ENV DEFAULT_TIMEOUT=30000

# Start the MCP server
CMD ["bun", "src/index.ts"] 