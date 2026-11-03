import { LoginForm } from "@/components/login-form";
import { AuthPage } from "@/components/auth/auth-page";
import { isStagingSmartRestoreAllowed } from "@/lib/settings/smart-restore-guard";

export default function Page() {
  return (
    <AuthPage>
      <LoginForm testingEnabled={isStagingSmartRestoreAllowed()} />
    </AuthPage>
  );
}
