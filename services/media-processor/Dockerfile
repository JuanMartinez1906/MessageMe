FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache tini vips-dev build-base python3

COPY shared/package.json shared/tsconfig.json ./shared/
COPY shared/src ./shared/src
COPY proto ./proto
COPY events ./events

WORKDIR /app/shared
RUN npm install --no-audit --no-fund && npm run build && rm -rf node_modules

WORKDIR /app
COPY services/media-processor/package.json services/media-processor/tsconfig.json ./services/media-processor/

WORKDIR /app/services/media-processor
RUN npm install --install-links --no-audit --no-fund

FROM deps AS build
COPY services/media-processor/src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini vips && \
    addgroup -S app && adduser -S app -G app
COPY --from=build /app/proto /app/proto
COPY --from=build /app/events /app/events
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/media-processor/node_modules /app/services/media-processor/node_modules
COPY --from=build /app/services/media-processor/dist /app/services/media-processor/dist
COPY --from=build /app/services/media-processor/package.json /app/services/media-processor/
USER app
WORKDIR /app/services/media-processor
ENV NODE_ENV=production
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
