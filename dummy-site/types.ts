export interface KubeAccess {
  server: string;
  token: string;
  caPem: string | null;
  insecureSkipVerify: boolean;
  namespace: string;
}

export type FetchInit = RequestInit & {
  tls?: { ca?: string | Uint8Array; rejectUnauthorized?: boolean };
};

export interface DummySite {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid: string;
    resourceVersion?: string;
  };
  spec: { website_url: string };
}

export interface WatchEvent {
  type: "ADDED" | "MODIFIED" | "DELETED" | "BOOKMARK" | "ERROR";
  object: any;
}
