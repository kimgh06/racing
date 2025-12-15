FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps for build)
COPY package.json ./
# 필요한 경우 사용하는 패키지 매니저의 lock 파일을 추가로 복사하세요 (하나만 사용하는 것을 권장)
# COPY package-lock.json ./
# COPY pnpm-lock.yaml ./
# COPY yarn.lock ./

RUN npm install

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

