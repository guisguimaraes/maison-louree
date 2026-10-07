# Site da Maison Lourée + servidor de pagamentos (Asaas), para o Coolify.
# 1) monta o site (Vite)  2) roda o servidor Node que entrega o site e fala com o Asaas

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
# pasta dos pedidos: monte um volume persistente aqui no Coolify
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/saude || exit 1
CMD ["node", "server/index.js"]
