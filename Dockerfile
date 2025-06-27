# Use Node LTS version
FROM node:22-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
# Copying this first prevents re-running npm ci on every code change.
COPY package*.json ./
COPY tsconfig.json ./

# Install app dependencies using the `npm ci` command.
RUN npm ci

# Copy local code to the container image.
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev

# Create a non-root user and switch to it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Run the web service on container startup.
CMD ["node", "build/index.js"]
