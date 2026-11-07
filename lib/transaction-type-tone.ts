// Arrows convey direction; color reinforces it but never replaces the glyph
// or +/- amount sign. Transfer is neutral navy rather than expense red.
export function transactionTypeIconClass(type: string): string {
  switch (type) {
    case "expense":
      return "bg-expense/10 text-expense";
    case "income":
      return "bg-income/10 text-income";
    case "transfer":
      return "bg-primary/10 text-primary";
    default:
      return "bg-surface-container text-on-surface-variant";
  }
}
