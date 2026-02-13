FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine AS production
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev

EXPOSE 8001
ENV PORT=8001 NODE_ENV=production

CMD ["npm", "run", "start"]