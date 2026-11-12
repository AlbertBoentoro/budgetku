"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";

/** Search committed transactions by merchant or note, independent of filter controls. */
export function TransactionSearch() {
  const searchId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQ = searchParams.get("q") ?? "";
  const [searchText, setSearchText] = useState(currentQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchText(currentQ);
  }, [currentQ]);

  const buildHref = useMemo(
    () => (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  function handleSearchChange(value: string) {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildHref(value.trim()), { scroll: false });
    }, 300);
  }

  function clearSearch() {
    setSearchText("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(buildHref(""), { scroll: false });
  }

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <section aria-label="Pencarian transaksi" className="flex flex-col gap-2">
      <label htmlFor={searchId} className="text-label-md font-semibold text-on-surface">
        Cari transaksi
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center justify-center text-on-surface-variant">
          <Icon name="search" size={22} />
        </span>
        <Input
          id={searchId}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={searchText}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="h-12 w-full rounded-xl border border-primary/40 bg-surface-container-lowest pl-11 pr-12 text-base text-on-surface shadow-sm transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 md:text-base"
          placeholder="Cari nama toko atau catatan transaksi"
          autoComplete="off"
        />
        {searchText ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="Hapus pencarian"
            className="absolute inset-y-0 right-2 my-auto flex size-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="close" size={18} />
          </button>
        ) : null}
      </div>
    </section>
  );
}
