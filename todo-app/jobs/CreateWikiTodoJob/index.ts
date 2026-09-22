import { SQL } from "bun";

import { config } from "./config";

const RANDOM_ARTICLE_URL = "https://en.wikipedia.org/wiki/Special:Random";
const WIKIPEDIA_ORIGIN = "https://en.wikipedia.org";

const db = new SQL(config.db);

const ensureTable = async () => {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db`
        CREATE TABLE IF NOT EXISTS todos (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          title text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          completed_at timestamptz
        )
      `;
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Database not ready (attempt ${attempt}/10): ${message}`);
      await Bun.sleep(2000);
    }
  }
  throw new Error("Could not initialize database table");
};

const fetchRandomArticle = async (): Promise<string> => {
  const response = await fetch(RANDOM_ARTICLE_URL, { redirect: "manual" });

  if (response.status === 301 || response.status === 302) {
    const location = response.headers.get("location");
    if (location) {
      return new URL(location, WIKIPEDIA_ORIGIN).toString();
    }
  }

  throw new Error(
    `Expected a redirect (301/302) from ${RANDOM_ARTICLE_URL}, got status ${response.status}`,
  );
};

await ensureTable();

const articleUrl = await fetchRandomArticle();
const title = `Read ${articleUrl}`;

const [todo] = await db`
  INSERT INTO todos (title) VALUES (${title})
  RETURNING id, title AS text, created_at, completed_at
`;

console.log(`Created todo: "${todo.text}"`);

await db.close();