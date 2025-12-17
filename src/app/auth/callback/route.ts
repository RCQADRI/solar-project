import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") || "/dashboard";

  const supabase = await createSupabaseServerClient();

  // Support both email confirmation styles:
  // - PKCE: ?code=...
  // - OTP verify: ?token_hash=...&type=signup
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const login = new URL("/login", url.origin);
      login.searchParams.set("error", "auth_callback_failed");
      return NextResponse.redirect(login);
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as any,
    });
    if (error) {
      const login = new URL("/login", url.origin);
      login.searchParams.set("error", "auth_verify_failed");
      return NextResponse.redirect(login);
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // If the link didn't include anything we can process, send user to login.
  return NextResponse.redirect(new URL("/login", url.origin));
}
