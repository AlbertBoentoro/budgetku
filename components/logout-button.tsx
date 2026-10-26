"use client";

import { useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// Optional Button props (variant, className, label) let callers restyle the
// trigger; the sign-out path below is the single shared implementation.
export function LogoutButton({
  children,
  ...rest
}: Omit<ButtonProps, "onClick">) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const logout = async () => {
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError(await response.text());
        return;
      }
      router.replace("/auth/login");
    } catch {
      setError("Tidak bisa keluar dari akun. Coba lagi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="flex flex-col gap-2">
      {error ? (
        <span role="alert" className="text-body-sm text-expense">
          {error}
        </span>
      ) : null}
      <Button {...rest} disabled={pending || rest.disabled} onClick={logout}>
        {pending ? "Keluar..." : children ?? "Logout"}
      </Button>
    </span>
  );
}
