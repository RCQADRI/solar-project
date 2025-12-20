"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditFooter } from "@/components/credit-footer";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);
  const [hasUser, setHasUser] = React.useState(false);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [linkError, setLinkError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const supabase = createSupabaseBrowserClient();

        // Supabase recovery links often land with tokens in the URL hash.
        // Newer PKCE flows can use a `code` query param.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorCode = url.searchParams.get("error_code");
        const errorDescription = url.searchParams.get("error_description");
        const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashError = hashParams.get("error");
        const hashErrorDescription = hashParams.get("error_description");

        // Handle error codes from Supabase (e.g., expired links)
        if (errorCode || hashError) {
          const errMsg = errorDescription || hashErrorDescription || "Link expired or invalid";
          if (!cancelled) {
            setError(errMsg.replace(/\+/g, " "));
            setHasUser(false);
            setReady(true);
          }
          return;
        }

        if (code) {
          try {
            const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
            if (codeError) {
              if (!cancelled) {
                // Check if it's an expired link error
                const isExpired = codeError.message?.toLowerCase().includes("expired") || 
                                  codeError.message?.toLowerCase().includes("invalid");
                setError(isExpired ? "This reset link has expired. Please request a new one." : codeError.message);
                setHasUser(false);
                setReady(true);
              }
              return;
            }
          } catch (exchangeErr: any) {
            if (!cancelled) {
              setError(exchangeErr?.message || "Failed to verify reset link.");
              setHasUser(false);
              setReady(true);
            }
            return;
          }
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""));
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) {
            if (!cancelled) {
              setError("This reset link has expired. Please request a new one.");
              setHasUser(false);
              setReady(true);
            }
            return;
          }
          window.history.replaceState({}, "", url.pathname + url.search);
        }

        const { data, error: getUserError } = await supabase.auth.getUser();
        if (!cancelled) {
          if (getUserError || !data.user) {
            setError(null); // Clear error, show invalid link UI
            setHasUser(false);
          } else {
            setHasUser(true);
          }
          setReady(true);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Something went wrong. Please try again.");
          setHasUser(false);
          setReady(true);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage("Password updated. Redirecting to sign in...");
      await supabase.auth.signOut();
      window.setTimeout(() => {
        router.replace("/login");
      }, 800);
    } catch (err: any) {
      setError(err?.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col p-4">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md animate-in fade-in-0 slide-in-from-bottom-3 duration-500 motion-reduce:animate-none">
          <div className="flex justify-end pb-3">
            <ThemeToggle />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Set a new password</CardTitle>
              <CardDescription>Choose a strong password for your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {!ready ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="ml-3 text-sm text-muted-foreground">Verifying your reset link...</span>
                </div>
              ) : !hasUser ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0\" fill="none\" viewBox="0 0 24 24\" stroke="currentColor\">
                        <path strokeLinecap="round\" strokeLinejoin="round\" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          {error || "This reset link is invalid or has expired"}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Password reset links expire after 24 hours for security. Please request a new link.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full">
                    <a href="/forgot-password">Request a new reset link</a>
                  </Button>
                  <div className="text-center">
                    <a className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors" href="/login">
                      Back to sign in
                    </a>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                  </div>

                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                  {message ? <p className="text-sm text-green-700">{message}</p> : null}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Updating..." : "Update password"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <CreditFooter className="pb-2" />
    </div>
  );
}
