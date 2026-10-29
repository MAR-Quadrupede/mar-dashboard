FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

CMD ["npm", "run", "start"]
