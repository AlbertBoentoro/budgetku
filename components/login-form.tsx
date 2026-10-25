"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMethod, setLoadingMethod] = useState<"email" | "google" | null>(
    null,
  );
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingMethod("email");
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          {
            invalid_credentials:
              "Email atau password salah. Periksa kembali, lalu coba lagi.",
          },
          "Belum bisa masuk sekarang. Coba lagi sebentar.",
        ),
      );
    } finally {
      setLoadingMethod(null);
    }
  };

  const handleGoogleLogin = async () => {
    setLoadingMethod("google");
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          {
            provider_disabled:
              "Masuk dengan Google belum tersedia. Coba gunakan email dan password.",
          },
          "Google tidak bisa digunakan sekarang. Coba lagi atau masuk dengan email dan password.",
        ),
      );
      setLoadingMethod(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Masuk
          </h1>
          <CardDescription className="text-slate-600 dark:text-slate-600">
            Masuk ke akun Budgetku kamu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-slate-500 bg-white text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:border-slate-500 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-500"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="inline-flex min-h-11 items-center text-sm text-slate-700 underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                  >
                    Lupa password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  aria-describedby={error ? "auth-error" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-slate-500 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:border-slate-500 dark:bg-white dark:text-slate-900"
                />
              </div>
              {error && (
                <p id="auth-error" className="text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="h-11 w-full focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                disabled={loadingMethod !== null}
              >
                {loadingMethod === "email" ? "Memeriksa..." : "Masuk dengan email"}
              </Button>
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span aria-hidden="true" className="h-px flex-1 bg-slate-300" />
                <span className="text-emerald-800">atau</span>
                <span aria-hidden="true" className="h-px flex-1 bg-slate-300" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-slate-500 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                disabled={loadingMethod !== null}
                onClick={handleGoogleLogin}
                aria-describedby={error ? "auth-error" : undefined}
              >
                {loadingMethod === "google"
                  ? "Menghubungkan..."
                  : "Lanjutkan dengan Google"}
              </Button>
            </div>
            <div className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-1 text-center text-sm text-slate-700">
              <span>Belum punya akun?</span>
              <Link
                href="/auth/sign-up"
                className="inline-flex min-h-11 items-center font-medium text-slate-900 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Daftar
              </Link>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </div>
  );
}
