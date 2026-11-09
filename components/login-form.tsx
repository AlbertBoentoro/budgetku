"use client";

import { useState } from "react";

import { AuthCard } from "@/components/auth/auth-page";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LoginForm({
  className,
  callbackPath = "/auth/callback",
  description = "Masuk atau buat akun Budgetku dengan Google.",
  testingEnabled = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  callbackPath?: string;
  description?: string;
  testingEnabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testingEmail, setTestingEmail] = useState("");
  const [testingPassword, setTestingPassword] = useState("");
  const [testingMode, setTestingMode] = useState<"login" | "signup">("login");
  const [testingMessage, setTestingMessage] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${callbackPath}`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          {
            provider_disabled: "Masuk dengan Google sedang tidak tersedia.",
          },
          "Google tidak bisa digunakan sekarang. Coba lagi sebentar.",
        ),
      );
      setLoading(false);
    }
  };

  async function handleTestingAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testingEnabled || loading) return;
    setLoading(true);
    setError(null);
    setTestingMessage("");
    try {
      const supabase = createClient();
      if (testingMode === "signup") {
        const { data, error: signupError } = await supabase.auth.signUp({
          email: testingEmail.trim(),
          password: testingPassword,
          options: { emailRedirectTo: `${window.location.origin}${callbackPath}` },
        });
        if (signupError) throw signupError;
        if (!data.session) {
          setTestingMessage(
            "Akun testing didaftarkan. Periksa email untuk verifikasi, lalu login di halaman ini.",
          );
          setTestingMode("login");
        } else {
          window.location.assign("/dashboard");
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: testingEmail.trim(),
          password: testingPassword,
        });
        if (loginError) throw loginError;
        window.location.assign("/dashboard");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login testing gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Masuk
          </h1>
          <CardDescription className="text-slate-600 dark:text-slate-600">
            {testingEnabled
              ? "Masuk dengan email dan password akun testing."
              : description}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-col gap-4">
            {error && (
              <p id="auth-error" className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {!testingEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-slate-500 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                disabled={loading}
                onClick={handleGoogleLogin}
                aria-describedby={error ? "auth-error" : undefined}
              >
                {loading ? "Menghubungkan..." : "Lanjutkan dengan Google"}
              </Button>
            ) : null}
            {testingEnabled ? (
              <div className="pt-2">
                <p className="mb-2 text-sm font-semibold text-slate-900">
                  Development / Testing
                </p>
                <p className="mb-3 text-xs text-slate-600">
                  Akun dan transaksi di sini terpisah dari Budgetku production.
                  Gunakan akun testing, bukan akun keuangan asli.
                </p>
                <form className="flex flex-col gap-3" onSubmit={handleTestingAuth}>
                  <label className="flex flex-col gap-1 text-sm text-slate-900">
                    Email testing
                    <input type="email" required autoComplete="email"
                      value={testingEmail} onChange={event => setTestingEmail(event.target.value)}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-slate-900">
                    Password testing
                    <input type="password" required minLength={8}
                      autoComplete={testingMode === "signup" ? "new-password" : "current-password"}
                      value={testingPassword} onChange={event => setTestingPassword(event.target.value)}
                      className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-slate-900" />
                  </label>
                  {testingMessage ? <p role="status" className="text-sm text-slate-700">{testingMessage}</p> : null}
                  <Button type="submit" disabled={loading} className="h-11 w-full">
                    {loading ? "Memproses..." : testingMode === "login" ? "Masuk ke Testing" : "Daftar Akun Testing"}
                  </Button>
                  <Button type="button" variant="ghost" disabled={loading}
                    onClick={() => {
                      setTestingMode(mode => mode === "login" ? "signup" : "login");
                      setError(null);
                      setTestingMessage("");
                    }}>
                    {testingMode === "login" ? "Belum punya akun? Daftar untuk testing" : "Sudah punya akun testing? Masuk"}
                  </Button>
                </form>
              </div>
            ) : null}
          </div>
        </CardContent>
      </AuthCard>
    </div>
  );
}
