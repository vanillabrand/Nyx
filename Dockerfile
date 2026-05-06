# Use Node.js LTS for stability
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build the application
COPY . .
RUN npm run build

# Production image
FROM node:22-slim

WORKDIR /app

# Copy built assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/public/data ./public/data

# Install production-only dependencies
RUN npm install --omit=dev

# Tactical Port Configuration
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
