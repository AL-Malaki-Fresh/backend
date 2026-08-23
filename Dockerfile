FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install dependencies
RUN npm ci --only=production

# Install additional required packages
RUN npm install cookie-parser multer
# Prisma config requires DATABASE_URL while generating the client.
# Prisma generate does not connect to this database.
ENV DATABASE_URL="postgresql://postgres:password@postgres:5432/almalaki"

RUN npx prisma generate
# Copy source code
COPY src ./src

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5001

CMD ["npm", "start"]