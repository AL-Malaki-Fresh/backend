FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Prisma config requires DATABASE_URL to be resolvable while generating the
# client (it does not connect to this database — the value is unused at
# runtime since docker-compose overrides it). This MUST be set before
# `npm ci`, because package.json's postinstall hook runs `prisma generate`
# as part of that install step.
ENV DATABASE_URL="postgresql://postgres:password@postgres:5432/almalaki"

# Install dependencies (cookie-parser, multer, express-rate-limit are
# already regular dependencies in package.json — no need to install
# them separately, and doing so weakens lockfile reproducibility). This
# also runs `prisma generate` via the postinstall hook.
RUN npm ci --only=production

# Copy source code
COPY src ./src

EXPOSE 5001

CMD ["npm", "start"]