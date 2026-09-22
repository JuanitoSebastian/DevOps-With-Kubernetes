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
  db: {
    hostname: requireEnv("DB_HOST"),
    port: requireNumericEnv("DB_PORT"),
    database: requireEnv("POSTGRES_DB"),
    username: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
  },
} as const;