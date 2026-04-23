FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/user-service/package.json services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/prisma ./services/user-service/prisma

WORKDIR /app/services/user-service
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/user-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/user-service/node_modules /app/services/user-service/node_modules
COPY --from=build /app/services/user-service/dist /app/services/user-service/dist
COPY --from=build /app/services/user-service/prisma /app/services/user-service/prisma
COPY --from=build /app/services/user-service/package.json /app/services/user-service/
USER app
WORKDIR /app/services/user-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
