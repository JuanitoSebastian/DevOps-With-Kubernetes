FROM oven/bun:1-alpine

WORKDIR /usr/src/app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile || bun install

COPY index.ts ./

CMD ["bun", "run", "index.ts"]
