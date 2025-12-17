"use client";

import * as React from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicSiteUrl } from "@/lib/site-url";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import { CreditFooter } from "@/components/credit-footer";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${getPublicSiteUrl()}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setMessage("If an account exists for this email, a reset link has been sent.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send reset email");
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
              <CardTitle>Reset password</CardTitle>
              <CardDescription>We’ll email you a secure reset link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {message ? <p className="text-sm text-green-700">{message}</p> : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send reset link"}
              </Button>

              <div className="text-sm text-muted-foreground">
                Remembered your password?{" "}
                <a className="underline underline-offset-4 transition-colors hover:text-foreground" href="/login">
                  Sign in
                </a>
              </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <CreditFooter className="pb-2" />
    </div>
  );
}
