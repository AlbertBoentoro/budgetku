import { cn } from "@/lib/utils";

interface IconProps {
  /** Material Symbols Outlined glyph name, e.g. "account_balance_wallet". */
  name: string;
  /** Rendered glyph size in px (maps to font-size and the opsz axis). */
  size?: number;
  /** Filled variant when true (FILL axis 1), outlined when false. */
  fill?: boolean;
  /** Stroke weight axis (100–700). Defaults to 400. */
  weight?: number;
  className?: string;
  /**
   * Accessible label. When provided the icon is exposed to assistive tech;
   * otherwise it is decorative (aria-hidden), matching the lucide convention
   * used across the app.
   */
  "aria-label"?: string;
}

export function Icon({
  name,
  size = 24,
  fill = false,
  weight = 400,
  className,
  "aria-label": ariaLabel,
}: IconProps) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      {name}
    </span>
  );
}
