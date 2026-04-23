FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/direct-service/package.json services/direct-service/tsconfig.json ./services/direct-service/
COPY services/direct-service/prisma ./services/direct-service/prisma

WORKDIR /app/services/direct-service
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/direct-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/direct-service/node_modules /app/services/direct-service/node_modules
COPY --from=build /app/services/direct-service/dist /app/services/direct-service/dist
COPY --from=build /app/services/direct-service/prisma /app/services/direct-service/prisma
COPY --from=build /app/services/direct-service/package.json /app/services/direct-service/
USER app
WORKDIR /app/services/direct-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
