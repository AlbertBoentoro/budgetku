import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBase64Url(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}

export function isRegistrationResponse(
  value: unknown,
): value is RegistrationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) return false;
  return (
    isBase64Url(value.id) &&
    isBase64Url(value.rawId) &&
    value.type === "public-key" &&
    isRecord(value.clientExtensionResults) &&
    isBase64Url(value.response.clientDataJSON) &&
    isBase64Url(value.response.attestationObject)
  );
}

export function isAuthenticationResponse(
  value: unknown,
): value is AuthenticationResponseJSON {
  if (!isRecord(value) || !isRecord(value.response)) return false;
  return (
    isBase64Url(value.id) &&
    isBase64Url(value.rawId) &&
    value.type === "public-key" &&
    isRecord(value.clientExtensionResults) &&
    isBase64Url(value.response.clientDataJSON) &&
    isBase64Url(value.response.authenticatorData) &&
    isBase64Url(value.response.signature)
  );
}

export function isChallengeId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
