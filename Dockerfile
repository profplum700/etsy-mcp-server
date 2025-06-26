# Use Node LTS version
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Expose port if server uses one (not necessary for MCP, using stdio)

# Run the server
CMD ["node", "build/index.js"]
