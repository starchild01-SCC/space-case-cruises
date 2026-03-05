FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backups ./backups
COPY --from=builder /app/migrations ./migrations
# Copy firebase-service-account.json to root (app expects it at ./)
COPY firebase-service-account.json ./
EXPOSE 4000
CMD ["sh", "-c", "node dist/scripts/init-db.js && node dist/server.js"]