FROM oven/bun:1-alpine AS build

WORKDIR /usr/src/app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY build.ts ./
COPY src ./src
COPY styles ./styles

RUN bun run build.ts

FROM oven/bun:1-alpine

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /usr/src/app/dist ./dist
COPY src ./src

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]