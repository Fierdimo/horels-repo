FROM node:20-bullseye AS base
WORKDIR /usr/src/app
COPY package*.json ./

############################
# Production deps (no dev)
############################
FROM base AS deps
RUN npm ci --omit=dev

############################
# Dev deps (includes devDependencies)
############################
FROM base AS dev-deps
RUN npm ci

############################
# Build stage (uses dev deps to compile)
############################
FROM dev-deps AS build
COPY . .
RUN npm run build

############################
# Dev runtime (target: dev) — includes source and dev deps
############################
FROM dev-deps AS dev
COPY . .
ENV NODE_ENV=development
CMD ["npm", "run", "start:worker"]

############################
# Production runtime — copy built dist and production deps
############################
FROM node:20-bullseye AS runtime
WORKDIR /usr/src/app
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/bin/start-worker.js"]
