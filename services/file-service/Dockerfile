FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto
COPY events ./events

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/file-service/package.json services/file-service/tsconfig.json ./services/file-service/
COPY services/file-service/prisma ./services/file-service/prisma

WORKDIR /app/services/file-service
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/file-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/events /app/events
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/file-service/node_modules /app/services/file-service/node_modules
COPY --from=build /app/services/file-service/dist /app/services/file-service/dist
COPY --from=build /app/services/file-service/prisma /app/services/file-service/prisma
COPY --from=build /app/services/file-service/package.json /app/services/file-service/
USER app
WORKDIR /app/services/file-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
