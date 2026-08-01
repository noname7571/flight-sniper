FROM node:25-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npx tsc

FROM node:25-alpine AS runner

WORKDIR /app

RUN apk add --no-cache tini

# Copy built output
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY frontend/ ../frontend/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
