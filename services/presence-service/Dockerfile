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
COPY services/presence-service/package.json services/presence-service/tsconfig.json ./services/presence-service/

WORKDIR /app/services/presence-service
RUN npm install --install-links --no-audit --no-fund

FROM deps AS build
COPY services/presence-service/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/events /app/events
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/presence-service/node_modules /app/services/presence-service/node_modules
COPY --from=build /app/services/presence-service/dist /app/services/presence-service/dist
COPY --from=build /app/services/presence-service/package.json /app/services/presence-service/
USER app
WORKDIR /app/services/presence-service
ENV NODE_ENV=production PROTO_DIR=/app/proto
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
