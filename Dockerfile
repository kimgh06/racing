FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps for build)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./ 2>/dev/null || true
RUN npm install --production=false

# Copy source and build Remix app
COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy only what is needed at runtime
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public

EXPOSE 3000

# Start Remix server
CMD ["npm", "run", "start"]


