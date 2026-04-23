FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/api-gateway/package.json services/api-gateway/tsconfig.json ./services/api-gateway/

WORKDIR /app/services/api-gateway
RUN npm install --install-links --no-audit --no-fund

FROM deps AS build
COPY services/api-gateway/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/api-gateway/node_modules /app/services/api-gateway/node_modules
COPY --from=build /app/services/api-gateway/dist /app/services/api-gateway/dist
COPY --from=build /app/services/api-gateway/package.json /app/services/api-gateway/
USER app
WORKDIR /app/services/api-gateway
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
