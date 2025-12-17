export function getPublicSiteUrl() {
  // Client-side: use the current origin so hosted environments (e.g. Vercel)
  // generate correct redirect URLs without requiring extra NEXT_PUBLIC envs.
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) {
    try {
      const u = new URL(explicit);
      return u.origin;
    } catch {
      return explicit.replace(/\/$/, "");
    }
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
