export function getAuthErrorMessage(
  error: unknown,
  messages: Readonly<Record<string, string>>,
  fallback: string,
) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = error.code;
    if (typeof code === "string") {
      return messages[code] ?? fallback;
    }
  }

  return fallback;
}
