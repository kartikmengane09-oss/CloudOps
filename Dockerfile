# Stage 1: Build dependencies and copy assets
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency specifications
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy codebase contents
COPY . .

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Set env context to production
ENV NODE_ENV=production

# Copy package configurations
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy app files from builder stage
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/public ./public

# Expose server port
EXPOSE 3000

# Use a non-root process user for container protection
USER node

# Start the dashboard server
CMD ["node", "src/server.js"]
