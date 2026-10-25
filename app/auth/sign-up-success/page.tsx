import Link from "next/link";

import { AuthCard, AuthPage } from "@/components/auth/auth-page";
import {
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export default function Page() {
  return (
    <AuthPage>
      <AuthCard>
        <CardHeader className="space-y-2 p-6 sm:p-8">
          <h1 className="text-2xl font-semibold leading-none tracking-tight">
            Cek email kamu
          </h1>
          <CardDescription className="text-slate-600 dark:text-slate-600">
            Satu langkah lagi untuk membuat akun.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-700">
            Buka email yang kamu daftarkan, lalu pilih tautan konfirmasi untuk
            mengaktifkan akun.
          </p>
          <Link
            href="/auth/login"
            className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-slate-900 underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            Kembali ke Masuk
          </Link>
        </CardContent>
      </AuthCard>
    </AuthPage>
  );
}
