import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/login-form";

export default function PasskeyRecoveryLoginPage() {
  return (
    <AuthPage>
      <LoginForm
        callbackPath="/auth/callback?next=%2Fauth%2Fpasskey-recovery"
        description="Masuk dengan Google untuk memulihkan akses dan menonaktifkan passkey yang hilang."
      />
    </AuthPage>
  );
}
