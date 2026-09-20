function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireNumericEnv(name: string): number {
  const raw = requireEnv(name);
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(
      `Environment variable ${name} must be a number, got: "${raw}"`,
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  todoBackendUrl: requireEnv("TODO_BACKEND_URL"),
  headerImage: {
    dir: requireEnv("HEADER_IMAGE_DIR"),
    url: requireEnv("HEADER_IMAGE_URL"),
    maxAgeMinutes: requireNumericEnv("IMAGE_MAX_AGE_MINUTES"),
  },
  isProduction: process.env.NODE_ENV === "production",
} as const;
