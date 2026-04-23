FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

# Context for this build is the monorepo root (see docker-compose.yml).
COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

# Build shared first so its dist/ exists before the service installs it via file:
# Remove node_modules after build so the service's npm install gets a clean copy
# (otherwise shared ends up with a duplicate @grpc/grpc-js nested in its node_modules,
# which breaks instanceof checks in gRPC clients).
WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/auth-service/package.json services/auth-service/tsconfig.json ./services/auth-service/
COPY services/auth-service/prisma ./services/auth-service/prisma

WORKDIR /app/services/auth-service
# --install-links forces npm to copy file: deps (shared) into node_modules
# instead of symlinking, which keeps Node's module resolution under the service root.
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/auth-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/auth-service/node_modules /app/services/auth-service/node_modules
COPY --from=build /app/services/auth-service/dist /app/services/auth-service/dist
COPY --from=build /app/services/auth-service/prisma /app/services/auth-service/prisma
COPY --from=build /app/services/auth-service/package.json /app/services/auth-service/
USER app
WORKDIR /app/services/auth-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
