"use client";

import { useState } from "react";
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

export function UpdatePasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error: unknown) {
      setError(
        getAuthErrorMessage(
          error,
          { weak_password: "Gunakan password yang lebih kuat." },
          "Password baru belum bisa disimpan. Coba lagi.",
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
            Buat password baru
          </h1>
          <CardDescription
            id="password-hint"
            className="text-slate-600 dark:text-slate-600"
          >
            Gunakan minimal 8 karakter.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <form onSubmit={handleUpdatePassword}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="password">Password baru</Label>
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
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">Konfirmasi password</Label>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  aria-describedby={error ? "auth-error" : undefined}
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
                {isLoading ? "Menyimpan..." : "Simpan password baru"}
              </Button>
            </div>
          </form>
        </CardContent>
      </AuthCard>
    </div>
  );
}
