import { z } from "zod";

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

const ServerEnvSchema = PublicEnvSchema.extend({
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB: z.string().min(1).optional(),
  INGEST_API_KEY: z.string().min(16).optional(), // Secret key for hardware ingestion
});

export type PublicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

export type ServerEnv = PublicEnv & {
  MONGODB_URI: string;
  MONGODB_DB: string;
  INGEST_API_KEY?: string; // Optional: for hardware data ingestion
};

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Missing/invalid Supabase env vars. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }

  const v = parsed.data;
  if (!v.NEXT_PUBLIC_SUPABASE_URL || !v.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing Supabase env vars. Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  cachedPublicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: v.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: v.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = ServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB,
    INGEST_API_KEY: process.env.INGEST_API_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Missing/invalid env vars. Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and MONGODB_URI in .env.local."
    );
  }

  const v = parsed.data;
  if (!v.NEXT_PUBLIC_SUPABASE_URL || !v.NEXT_PUBLIC_SUPABASE_ANON_KEY || !v.MONGODB_URI) {
    throw new Error(
      "Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, MONGODB_URI."
    );
  }

  cachedServerEnv = {
    NEXT_PUBLIC_SUPABASE_URL: v.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: v.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    MONGODB_URI: v.MONGODB_URI,
    MONGODB_DB: v.MONGODB_DB ?? "solar",
    INGEST_API_KEY: v.INGEST_API_KEY,
  };
  return cachedServerEnv;
}
