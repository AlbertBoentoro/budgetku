const JAKARTA_TIME_ZONE = "Asia/Jakarta";

export function formatGmailDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: JAKARTA_TIME_ZONE,
  }).format(date);
}

export function toGmailDateInputValue(value: string | null): string {
  const parsedDate = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}
