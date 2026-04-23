FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/channel-service/package.json services/channel-service/tsconfig.json ./services/channel-service/
COPY services/channel-service/prisma ./services/channel-service/prisma

WORKDIR /app/services/channel-service
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/channel-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/channel-service/node_modules /app/services/channel-service/node_modules
COPY --from=build /app/services/channel-service/dist /app/services/channel-service/dist
COPY --from=build /app/services/channel-service/prisma /app/services/channel-service/prisma
COPY --from=build /app/services/channel-service/package.json /app/services/channel-service/
USER app
WORKDIR /app/services/channel-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
