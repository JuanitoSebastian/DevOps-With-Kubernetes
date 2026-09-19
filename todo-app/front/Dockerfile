FROM oven/bun:1-alpine AS build

WORKDIR /usr/src/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY app ./app
COPY react-router.config.ts vite.config.ts tsconfig.json bun-env.d.ts ./

RUN bun run build

FROM oven/bun:1-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /usr/src/app/build ./build
COPY server.ts ./

EXPOSE 3000

CMD ["bun", "run", "server.ts"]