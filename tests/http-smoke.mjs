// Non-destructive production smoke check. No credentials, database writes or secrets.
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://budgetku-weld.vercel.app";
const tests = [
  { path: "/", accept: (r) => r.status >= 200 && r.status < 400, label: "Public root reachable" },
  { path: "/auth/login", accept: (r) => r.status === 200 && (r.headers.get("content-type") ?? "").includes("text/html"), label: "Login page renders" },
  { path: "/dashboard", accept: (r) => [302, 303, 307, 308].includes(r.status) && new URL(r.headers.get("location"), origin).pathname === "/auth/login", label: "Dashboard redirects unauthenticated visitor" },
  { path: "/api/settings/backup", accept: (r) => [302, 303, 307, 308, 401, 403].includes(r.status), label: "Anonymous backup download denied" },
  { path: "/api/settings/backup/history", accept: (r) => [302, 303, 307, 308, 401, 403].includes(r.status), label: "Anonymous backup history denied" },
  { path: "/api/settings/backup/inspect", accept: (r) => [302, 303, 307, 308, 401, 403].includes(r.status), label: "Anonymous backup inspection denied" },
];

async function check(test) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response;
      try {
        response = await fetch(origin + test.path, {
          redirect: "manual",
          headers: { "User-Agent": "Budgetku-P0-ReadOnly-Smoke/1.0", Accept: "text/html,application/json" },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      console.log(test.label + ": HTTP " + response.status + " " + test.path + "; location=" + (response.headers.get("location") ?? "-"));
      assert.ok(test.accept(response), "Unexpected response for " + test.path + ": HTTP " + response.status);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(1200 * attempt);
    }
  }
  throw new Error(test.label + ": " + String(lastError));
}

for (const test of tests) await check(test);
console.log("PASS: all public and anonymous HTTP smoke checks");
