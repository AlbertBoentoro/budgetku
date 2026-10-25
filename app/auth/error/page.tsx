import Link from "next/link";

import { AuthCard, AuthPage } from "@/components/auth/auth-page";
import { CardContent, CardHeader } from "@/components/ui/card";

export default function Page() {
  return (
    <AuthPage>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Tautan tidak bisa digunakan
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-600">
            Tautan mungkin sudah kedaluwarsa atau tidak valid. Minta tautan
            baru untuk melanjutkan.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 px-6 pb-6 sm:px-8 sm:pb-8">
          <Link
            href="/auth/forgot-password"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Minta tautan reset baru
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-slate-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Kembali ke Masuk
          </Link>
        </CardContent>
      </AuthCard>
    </AuthPage>
  );
}
