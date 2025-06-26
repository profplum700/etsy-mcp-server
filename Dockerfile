# Use Node LTS version
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files and source code first (needed for prepare script during npm ci)
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

# Install app dependencies (including dev dependencies for build)
# The prepare script will run during npm ci and build the project
RUN npm ci

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Expose port if server uses one (not necessary for MCP, using stdio)

# Run the server
CMD ["node", "build/index.js"]
