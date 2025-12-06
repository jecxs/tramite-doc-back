FROM node:22-alpine AS builder
WORKDIR /app

# Instalar dependencias para compilar
COPY package*.json ./
RUN npm ci

# Generar cliente de Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Copiar fuentes y compilar NestJS
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiar artefactos de build y dependencias
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Directorio para uploads (se montará como volumen en Compose)
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

CMD ["sh", "-lc", "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main.js"]
