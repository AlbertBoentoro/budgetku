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
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
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
            provider_disabled: "Masuk dengan Google sedang tidak tersedia.",
          },
          "Google tidak bisa digunakan sekarang. Coba lagi sebentar.",
        ),
      );
      setLoading(false);
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
            Masuk atau buat akun Budgetku dengan Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-col gap-4">
            {error && (
              <p id="auth-error" className="text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
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
          </div>
        </CardContent>
      </AuthCard>
    </div>
  );
}
