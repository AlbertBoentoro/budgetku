"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// Optional Button props (variant, className, label) let callers restyle the
// trigger; the sign-out path below is the single shared implementation.
export function LogoutButton({
  children,
  ...rest
}: Omit<ButtonProps, "onClick">) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button {...rest} onClick={logout}>
      {children ?? "Logout"}
    </Button>
  );
}
