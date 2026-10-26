FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

# Install dependencies based on package-lock.json
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Generate Prisma client if schema exists
RUN npx prisma generate

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]
