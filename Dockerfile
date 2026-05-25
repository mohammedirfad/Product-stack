FROM node:24-alpine AS api

WORKDIR /app

ENV NODE_ENV=production
ENV API_PORT=4000
ENV DATA_DIR=/app/data

COPY package*.json ./
RUN npm ci --omit=dev

COPY backend ./backend
COPY docs ./docs

RUN mkdir -p /app/data && addgroup -S app && adduser -S app -G app && chown -R app:app /app

USER app

EXPOSE 4000

CMD ["node", "backend/src/server.js"]
