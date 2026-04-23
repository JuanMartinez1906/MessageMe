FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/group-service/package.json services/group-service/tsconfig.json ./services/group-service/
COPY services/group-service/prisma ./services/group-service/prisma

WORKDIR /app/services/group-service
RUN npm install --install-links --no-audit --no-fund
RUN npx prisma generate

FROM deps AS build
COPY services/group-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/group-service/node_modules /app/services/group-service/node_modules
COPY --from=build /app/services/group-service/dist /app/services/group-service/dist
COPY --from=build /app/services/group-service/prisma /app/services/group-service/prisma
COPY --from=build /app/services/group-service/package.json /app/services/group-service/
USER app
WORKDIR /app/services/group-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
