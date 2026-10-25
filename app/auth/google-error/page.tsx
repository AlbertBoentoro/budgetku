import Link from "next/link";

import { AuthCard, AuthPage } from "@/components/auth/auth-page";
import { CardContent, CardHeader } from "@/components/ui/card";

export default function Page() {
  return (
    <AuthPage>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Tidak bisa masuk dengan Google
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-600">
            Proses masuk tidak selesai. Coba lagi dari halaman masuk atau
            gunakan email dan password.
          </p>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <Link
            href="/auth/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Kembali ke Masuk
          </Link>
        </CardContent>
      </AuthCard>
    </AuthPage>
  );
}
