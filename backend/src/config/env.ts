import dotenv from "dotenv";

dotenv.config({ quiet: true });

const validNodeEnvironments = new Set(["development", "test", "production"]);
const jwtExpirationPattern = /^\d+[smhd]$/;

function readPort(value: string | undefined): number {
  const port = Number(value ?? 4000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function readNodeEnv(value: string | undefined): "development" | "test" | "production" {
  const nodeEnv = value ?? "development";

  if (!validNodeEnvironments.has(nodeEnv)) {
    throw new Error("NODE_ENV must be development, test, or production.");
  }

  return nodeEnv as "development" | "test" | "production";
}

function readFrontendUrl(value: string | undefined): string {
  const frontendUrl = value ?? "http://localhost:5173";

  try {
    return new URL(frontendUrl).origin;
  } catch {
    throw new Error("FRONTEND_URL must be a valid URL.");
  }
}

function readJwtSecret(value: string | undefined): string {
  if (!value || value.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  return value;
}

function readJwtExpiresIn(value: string | undefined): string {
  if (!value || !jwtExpirationPattern.test(value)) {
    throw new Error("JWT_EXPIRES_IN must be a positive duration such as 1h or 30m.");
  }

  return value;
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database operations.");
  }

  try {
    const url = new URL(databaseUrl);

    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
      throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
    }
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  return databaseUrl;
}

export const env = {
  port: readPort(process.env.PORT),
  nodeEnv: readNodeEnv(process.env.NODE_ENV),
  frontendUrl: readFrontendUrl(process.env.FRONTEND_URL),
  jwtSecret: readJwtSecret(process.env.JWT_SECRET),
  jwtExpiresIn: readJwtExpiresIn(process.env.JWT_EXPIRES_IN),
};
