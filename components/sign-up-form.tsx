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

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Gunakan password dengan minimal 8 karakter.");
      return;
    }

    if (password !== repeatPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          {
            user_already_exists:
              "Email ini sudah terdaftar. Silakan masuk dengan akun kamu.",
            weak_password: "Gunakan password yang lebih kuat.",
          },
          "Akun belum bisa dibuat sekarang. Coba lagi sebentar.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Daftar
          </h1>
          <CardDescription className="text-slate-600 dark:text-slate-600">
            Buat akun Budgetku dengan email kamu.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleSignUp}>
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
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby="password-hint"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-slate-500 bg-white text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:border-slate-500 dark:bg-white dark:text-slate-900"
                />
                <p
                  id="password-hint"
                  className="text-sm text-slate-600 dark:text-slate-600"
                >
                  Minimal 8 karakter.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">Konfirmasi password</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
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
                disabled={isLoading}
              >
                {isLoading ? "Membuat akun..." : "Buat akun"}
              </Button>
            </div>
            <div className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-1 text-center text-sm text-slate-700">
              <span>Sudah punya akun?</span>
              <Link
                href="/auth/login"
                className="inline-flex min-h-11 items-center font-medium text-slate-900 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Masuk
              </Link>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </div>
  );
}
