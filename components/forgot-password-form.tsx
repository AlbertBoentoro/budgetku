"use client";

import { useState } from "react";
import Link from "next/link";

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

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          {
            over_email_send_rate_limit:
              "Terlalu banyak permintaan. Tunggu sebentar sebelum mencoba lagi.",
          },
          "Email reset belum bisa dikirim. Periksa alamat email dan coba lagi.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <div role="status">
          <AuthCard>
            <CardHeader className="space-y-2 p-6 sm:p-8">
              <h1 className="text-2xl font-semibold leading-none tracking-tight">
                Cek email kamu
              </h1>
              <CardDescription className="text-slate-600 dark:text-slate-600">
                Jika email terdaftar, tautan untuk mengatur ulang password akan
                dikirim.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-700">
                Jika alamat email terdaftar, kamu akan menerima tautan untuk
                membuat password baru.
              </p>
              <Link
                href="/auth/login"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Kembali ke Masuk
              </Link>
            </CardContent>
          </AuthCard>
        </div>
      ) : (
        <AuthCard>
          <CardHeader className="space-y-2 p-6 sm:p-8">
            <h1 className="text-2xl font-semibold leading-none tracking-tight">
              Lupa password?
            </h1>
            <CardDescription className="text-slate-600 dark:text-slate-600">
              Masukkan email akun kamu untuk menerima tautan reset password.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
            <form onSubmit={handleForgotPassword}>
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
                  {isLoading ? "Mengirim..." : "Kirim tautan reset"}
                </Button>
              </div>
              <div className="mt-4 flex min-h-11 flex-wrap items-center justify-center gap-1 text-center text-sm text-slate-700">
                <span>Ingat password kamu?</span>
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
      )}
    </div>
  );
}
