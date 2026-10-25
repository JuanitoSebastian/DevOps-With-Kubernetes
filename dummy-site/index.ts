/**
 * DummySite controller
 *
 * Watches DummySite custom resources (group stable.dwk, version v1) and, for
 * each one, fetches the HTML behind `spec.website_url` and serves a copy via:
 *   - a ConfigMap holding the HTML as `index.html`,
 *   - an nginx Deployment mounting that ConfigMap,
 *   - a ClusterIP Service exposing the Deployment.
 *
 * Talks to the Kubernetes REST API directly with fetch — no client library.
 * In-cluster auth uses the mounted ServiceAccount token + CA. Outside the
 * cluster (e.g. via `kubectl proxy`) it can be pointed at another API with
 * KUBE_API_URL / KUBE_TOKEN / KUBE_NAMESPACE / KUBE_INSECURE_SKIP_VERIFY.
 */

import type { DummySite, FetchInit, KubeAccess, WatchEvent } from "./types.ts";

const GROUP = "stable.dwk";
const VERSION = "v1";
const PLURAL = "dummysites";

// Keep well under the ~1 MiB ConfigMap/etcd object limit.
const MAX_HTML_BYTES = 900_000;
const FETCH_TIMEOUT_MS = 15_000;
const WATCH_TIMEOUT_SECONDS = 120;
const RETRY_DELAY_MS = 3_000;

async function readFileOrNull(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    return (await file.text()).trim() || null;
  } catch {
    return null;
  }
}

async function loadKubeAccess(): Promise<KubeAccess> {
  const saDir = "/var/run/secrets/kubernetes.io/serviceaccount";
  const saToken = await readFileOrNull(`${saDir}/token`);
  if (saToken) {
    const host =
      process.env.KUBERNETES_SERVICE_HOST ?? "kubernetes.default.svc";
    const port = process.env.KUBERNETES_SERVICE_PORT ?? "443";
    return {
      server: `https://${host}:${port}`,
      token: saToken,
      caPem: await readFileOrNull(`${saDir}/ca.crt`),
      insecureSkipVerify: false,
      namespace:
        process.env.KUBE_NAMESPACE ??
        (await readFileOrNull(`${saDir}/namespace`)) ??
        "default",
    };
  }
  // Local development fallback (e.g. `kubectl proxy --port=8001` + KUBE_API_URL).
  const caFile = process.env.KUBE_CA_FILE;
  return {
    server: process.env.KUBE_API_URL ?? "https://kubernetes.default.svc",
    token: process.env.KUBE_TOKEN ?? "",
    caPem: caFile ? await readFileOrNull(caFile) : null,
    insecureSkipVerify: process.env.KUBE_INSECURE_SKIP_VERIFY === "true",
    namespace: process.env.KUBE_NAMESPACE ?? "default",
  };
}

const kube = await loadKubeAccess();

function apiInit(method: string, body?: unknown): FetchInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (kube.token) headers.Authorization = `Bearer ${kube.token}`;
  const init: FetchInit = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  if (kube.caPem) {
    init.tls = { ca: kube.caPem };
  } else if (kube.insecureSkipVerify || kube.server.startsWith("http://")) {
    init.tls = { rejectUnauthorized: false };
  }
  return init;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${kube.server}${path}`, apiInit(method, body));
  if (res.status === 404)
    throw new ApiError(404, `Not found: ${method} ${path}`);
  if (res.status === 409)
    throw new ApiError(409, `Conflict: ${method} ${path}`);
  if (res.status === 410) throw new ApiError(410, `Gone: ${method} ${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      res.status,
      `${method} ${path} -> ${res.status}: ${text}`,
    );
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const log = (...args: unknown[]) =>
  console.log(new Date().toISOString(), "-", ...args);

/** Make a DNS-1123-safe child resource name from the DummySite name. */
function childName(base: string, suffix: string): string {
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52 - suffix.length);
  return `${safe}${suffix}`;
}

async function fetchSite(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid website_url: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol in website_url: ${url}`);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "dummysite-controller/1.0" },
    });
    if (!res.ok) throw new Error(`Fetching ${url} failed: HTTP ${res.status}`);
    let html = await res.text();
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > MAX_HTML_BYTES) {
      log(`WARNING: HTML (${bytes} bytes) exceeds limit, truncating`);
      // Slice on bytes to stay valid under the limit.
      const buf = new TextEncoder().encode(html).slice(0, MAX_HTML_BYTES);
      html = new TextDecoder().decode(buf, { stream: false });
    }
    return html;
  } finally {
    clearTimeout(timer);
  }
}

async function upsert(kind: string, path: string, name: string, manifest: any) {
  let existing: any = null;
  try {
    existing = await api("GET", `${path}/${name}`);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
  }
  if (!existing) {
    await api("POST", path, manifest);
    log(`Created ${kind} ${name}`);
  } else {
    manifest.metadata.resourceVersion = existing.metadata.resourceVersion;
    await api("PUT", `${path}/${name}`, manifest);
    log(`Updated ${kind} ${name}`);
  }
}

async function deleteIfExists(kind: string, path: string, name: string) {
  try {
    await api("DELETE", `${path}/${name}`);
    log(`Deleted ${kind} ${name}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      log(`${kind} ${name} already gone, skipping`);
      return;
    }
    throw err;
  }
}

function childManifests(site: DummySite, html: string) {
  const name = site.metadata.name;
  const cmName = childName(name, "-html");
  const depName = childName(name, "");
  const svcName = childName(name, "-svc");
  const labels = { app: depName, dummysite: name };
  const ownerReferences = [
    {
      apiVersion: `${GROUP}/${VERSION}`,
      kind: "DummySite",
      name,
      uid: site.metadata.uid,
    },
  ];

  const configMap = {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: cmName,
      namespace: kube.namespace,
      labels,
      ownerReferences,
    },
    data: { "index.html": html },
  };

  const deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: depName,
      namespace: kube.namespace,
      labels,
      ownerReferences,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: { app: depName } },
      template: {
        metadata: { labels: { app: depName } },
        spec: {
          containers: [
            {
              name: "nginx",
              image: "nginx:1.27-alpine",
              ports: [{ containerPort: 80 }],
              volumeMounts: [
                { name: "html", mountPath: "/usr/share/nginx/html" },
              ],
            },
          ],
          volumes: [{ name: "html", configMap: { name: cmName } }],
        },
      },
    },
  };

  const service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: svcName,
      namespace: kube.namespace,
      labels,
      ownerReferences,
    },
    spec: {
      selector: { app: depName },
      ports: [{ port: 80, targetPort: 80 }],
    },
  };

  return { cmName, depName, svcName, configMap, deployment, service };
}

async function reconcile(site: DummySite) {
  const { name } = site.metadata;
  const url = site.spec?.website_url;
  if (!url) {
    log(`DummySite ${name} has no spec.website_url, skipping`);
    return;
  }
  log(`Reconciling DummySite ${name} (website_url=${url})`);
  const html = await fetchSite(url);
  const m = childManifests(site, html);
  await upsert(
    "ConfigMap",
    `/api/v1/namespaces/${kube.namespace}/configmaps`,
    m.cmName,
    m.configMap,
  );
  await upsert(
    "Deployment",
    `/apis/apps/v1/namespaces/${kube.namespace}/deployments`,
    m.depName,
    m.deployment,
  );
  await upsert(
    "Service",
    `/api/v1/namespaces/${kube.namespace}/services`,
    m.svcName,
    m.service,
  );
  log(`DummySite ${name} ready -> Service ${m.svcName}:80`);
}

async function cleanup(site: DummySite) {
  const { name } = site.metadata;
  log(`Cleaning up DummySite ${name}`);
  // Names are deterministic, so we can delete without fetching the HTML again.
  const svcName = childName(name, "-svc");
  const depName = childName(name, "");
  const cmName = childName(name, "-html");
  await deleteIfExists(
    "Service",
    `/api/v1/namespaces/${kube.namespace}/services`,
    svcName,
  );
  await deleteIfExists(
    "Deployment",
    `/apis/apps/v1/namespaces/${kube.namespace}/deployments`,
    depName,
  );
  await deleteIfExists(
    "ConfigMap",
    `/api/v1/namespaces/${kube.namespace}/configmaps`,
    cmName,
  );
}

function watchUrl(resourceVersion?: string): string {
  let url =
    `${kube.server}/apis/${GROUP}/${VERSION}/namespaces/${kube.namespace}/${PLURAL}` +
    `?watch=true&timeoutSeconds=${WATCH_TIMEOUT_SECONDS}`;
  if (resourceVersion)
    url += `&resourceVersion=${encodeURIComponent(resourceVersion)}`;
  return url;
}

async function* streamEvents(url: string): AsyncGenerator<WatchEvent> {
  const res = await fetch(url, apiInit("GET"));
  if (res.status === 410)
    throw new ApiError(410, "watch resourceVersion too old");
  if (!res.ok || !res.body) {
    throw new Error(`watch request failed: HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        yield JSON.parse(trimmed) as WatchEvent;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function run() {
  log(
    `dummysite-controller starting (namespace=${kube.namespace}, api=${kube.server})`,
  );
  while (true) {
    try {
      // Initial list also replays existing objects as reconciliations,
      // so restarts converge instead of missing anything.
      const list = await api(
        "GET",
        `/apis/${GROUP}/${VERSION}/namespaces/${kube.namespace}/${PLURAL}`,
      );
      for (const item of list.items ?? []) {
        try {
          await reconcile(item as DummySite);
        } catch (err) {
          log(
            `Reconcile of ${(item as DummySite).metadata?.name} failed:`,
            err,
          );
        }
      }
      let resourceVersion: string | undefined = list.metadata?.resourceVersion;

      for await (const event of streamEvents(watchUrl(resourceVersion))) {
        const obj = event.object;
        resourceVersion = obj?.metadata?.resourceVersion ?? resourceVersion;
        if (event.type === "ERROR") {
          log(
            "Watch ERROR event, reconnecting:",
            JSON.stringify(obj).slice(0, 300),
          );
          break;
        }
        if (event.type === "BOOKMARK") continue;
        if (!obj?.metadata?.name) continue;
        try {
          if (event.type === "DELETED") await cleanup(obj as DummySite);
          else await reconcile(obj as DummySite);
        } catch (err) {
          log(`Handling ${event.type} ${obj.metadata.name} failed:`, err);
        }
      }
      log("Watch stream closed, reconnecting");
    } catch (err) {
      log("Controller loop error (will retry):", err);
      await Bun.sleep(RETRY_DELAY_MS);
    }
  }
}

run();
