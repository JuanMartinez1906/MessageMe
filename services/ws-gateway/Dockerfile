FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache tini

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto
COPY events ./events

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/ws-gateway/package.json services/ws-gateway/tsconfig.json ./services/ws-gateway/

WORKDIR /app/services/ws-gateway
RUN npm install --install-links --no-audit --no-fund

FROM deps AS build
COPY services/ws-gateway/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/events /app/events
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/ws-gateway/node_modules /app/services/ws-gateway/node_modules
COPY --from=build /app/services/ws-gateway/dist /app/services/ws-gateway/dist
COPY --from=build /app/services/ws-gateway/package.json /app/services/ws-gateway/
USER app
WORKDIR /app/services/ws-gateway
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
