import Link from "next/link";

import { Icon } from "@/components/ui/icon";

interface AppBackLinkProps {
  href: string;
  label: string;
}

export function AppBackLink({ href, label }: AppBackLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon name="arrow_back" size={20} />
    </Link>
  );
}
