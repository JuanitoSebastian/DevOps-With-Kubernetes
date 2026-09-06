import type { Route } from "./+types/header-image";

const imageDir = process.env.HEADER_IMAGE_DIR ?? "/usr/src/todo-app/header-image";
const maxAgeMinutes = Number(process.env.IMAGE_MAX_AGE_MINUTES) || 10;
const imageUrl = process.env.HEADER_IMAGE_URL ?? "https://picsum.photos/1200";
const maxAgeMs = maxAgeMinutes * 60 * 1000;

const now = () => Date.now();

function listCachedImages(): { path: string; ageMs: number }[] {
  const images = new Bun.Glob("*.jpg").scanSync({ cwd: imageDir });
  const cached: { path: string; ageMs: number }[] = [];
  for (const name of images) {
    const timestamp = Number.parseInt(name.replace(".jpg", ""), 10);
    if (Number.isFinite(timestamp)) {
      cached.push({ path: `${imageDir}/${name}`, ageMs: now() - timestamp });
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
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Image API responded with ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const filePath = `${imageDir}/${now()}.jpg`;
  await Bun.write(filePath, bytes);
  await pruneOlderThan(filePath);
  return filePath;
}

export async function loader(_args: Route.LoaderArgs): Promise<Response> {
  await Bun.$`mkdir -p ${imageDir}`;

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