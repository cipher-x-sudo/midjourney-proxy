# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS production
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only (as root)
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Copy configuration files
COPY src/config/ ./src/config/
COPY src/resources/ ./src/resources/

# Set ownership to node user (node:18-alpine base image includes node user with UID 1000)
# Must be done as root before switching users
RUN chown -R node:node /app

# Switch to non-root user (node user exists in node:18-alpine base image)
USER node

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
