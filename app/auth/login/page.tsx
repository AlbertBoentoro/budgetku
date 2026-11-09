import { LoginForm } from "@/components/login-form";
import { AuthPage } from "@/components/auth/auth-page";
import { isStagingEmailLoginAllowed } from "@/lib/auth/staging-email-login";

export default function Page() {
  return (
    <AuthPage>
      <LoginForm testingEnabled={isStagingEmailLoginAllowed()} />
    </AuthPage>
  );
}
