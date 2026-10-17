import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";

interface TransactionFieldRowProps {
  // Material Symbols glyph identifying the field.
  icon: string;
  // The control's id, so the label targets it.
  htmlFor: string;
  label: string;
  children: React.ReactNode;
  // Rendered below the row; the caller supplies the role="alert" error node.
  error?: React.ReactNode;
  className?: string;
}

// A labeled row inside the Stitch field card: a leading icon, the label, and
// the existing control. Purely presentational; it does not own any state or
// change which value the control submits.
export function TransactionFieldRow({
  icon,
  htmlFor,
  label,
  children,
  error,
  className,
}: TransactionFieldRowProps) {
  return (
    <div className={cn("flex flex-col gap-2 p-lg", className)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
          <Icon name={icon} size={20} />
        </span>
        <Label htmlFor={htmlFor} className="text-body-md text-on-surface">
          {label}
        </Label>
      </div>
      {children}
      {error}
    </div>
  );
}
