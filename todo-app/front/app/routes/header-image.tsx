import { config } from "../config.server";
import type { Route } from "./+types/header-image";

const now = () => Date.now();

function listCachedImages(): { path: string; ageMs: number }[] {
  const { dir } = config.headerImage;
  const images = new Bun.Glob("*.jpg").scanSync({ cwd: dir });
  const cached: { path: string; ageMs: number }[] = [];
  for (const name of images) {
    const timestamp = Number.parseInt(name.replace(".jpg", ""), 10);
    if (Number.isFinite(timestamp)) {
      cached.push({ path: `${dir}/${name}`, ageMs: now() - timestamp });
    }
  }
  return cached.sort((a, b) => a.ageMs - b.ageMs);
}

function newestCached(): { path: string; ageMs: number } | undefined {
  const cached = listCachedImages();
  return cached.length === 0 ? undefined : cached[cached.length - 1];
}

async function pruneOlderThan(newestPath: string): Promise<void> {
  for (const file of listCachedImages()) {
    if (file.path !== newestPath) {
      await Bun.$`rm -f ${file.path}`;
    }
  }
}

function serveFile(path: string): Response {
  return new Response(Bun.file(path), {
    headers: { "Content-Type": "image/jpeg" },
  });
}

async function cacheImage(): Promise<string> {
  const { dir, url } = config.headerImage;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image API responded with ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const filePath = `${dir}/${now()}.jpg`;
  await Bun.write(filePath, bytes);
  await pruneOlderThan(filePath);
  return filePath;
}

export async function loader(_args: Route.LoaderArgs): Promise<Response> {
  const { dir, maxAgeMinutes } = config.headerImage;
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  await Bun.$`mkdir -p ${dir}`;

  const cached = newestCached();

  if (cached && cached.ageMs < maxAgeMs) {
    return serveFile(cached.path);
  }

  try {
    const path = await cacheImage();
    return serveFile(path);
  } catch (error) {
    console.error("Failed to refresh header image:", error);
    return cached
      ? serveFile(cached.path)
      : new Response("Header image unavailable", { status: 503 });
  }
}