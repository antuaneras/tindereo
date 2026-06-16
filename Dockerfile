FROM node:22-bookworm-slim

WORKDIR /app

ENV PORT=10000

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN mkdir -p /app/storage
RUN npm run build:full
RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 10000

CMD ["npm", "run", "start"]
