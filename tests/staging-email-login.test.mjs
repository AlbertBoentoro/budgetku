import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isStagingEmailLoginAllowed } from "../lib/auth/staging-email-login.ts";

const stage = "https://omnzuolrlwczvnxrvenw.supabase.co";
const prod = "https://zvmqrrttdrqkyrdzyxlf.supabase.co";
const keys = ["VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL"];
function withEnv(env, callback) {
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) {
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
    }
    callback();
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("staging and local dev with exact staging URL expose the old email/password flow", () => {
  for (const environment of ["preview", "development", undefined]) {
    withEnv({ VERCEL_ENV: environment, NEXT_PUBLIC_SUPABASE_URL: stage }, () => {
      assert.equal(isStagingEmailLoginAllowed(), true);
    });
  }
});

test("production, near-match URL and production URL never expose testing password login", () => {
  for (const environment of ["production", "preview", "development", undefined]) {
    withEnv({ VERCEL_ENV: environment, NEXT_PUBLIC_SUPABASE_URL: prod }, () => {
      assert.equal(isStagingEmailLoginAllowed(), false);
    });
  }
  withEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: stage }, () => {
    assert.equal(isStagingEmailLoginAllowed(), false);
  });
  withEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: stage + "/" }, () => {
    assert.equal(isStagingEmailLoginAllowed(), false);
  });
});

test("login page no longer uses Smart Restore to decide whether email/password is available", () => {
  const page = source("app/auth/login/page.tsx");
  assert.match(page, /isStagingEmailLoginAllowed\(\)/);
  assert.doesNotMatch(page, /isStagingSmartRestoreAllowed/);
  const login = source("components/login-form.tsx");
  assert.match(login, /!testingEnabled \? \(/);
  assert.match(login, /testingEnabled \? \(/);
  assert.match(login, /signInWithPassword/);
  assert.match(login, /signUp/);
  assert.match(login, /Masuk ke Testing/);
  assert.match(login, /Daftar Akun Testing/);
  assert.match(login, /Lanjutkan dengan Google/);
  assert.match(login, /testingEnabled\s*\? "Masuk dengan email dan password akun testing\."/);
});

test("durable policy is recorded for subsequent agents and release checks", () => {
  const doc = source("docs/testing-login-contract.md");
  const agents = source("AGENTS.md");
  assert.match(doc, /email \+ password/);
  assert.match(doc, /Google OAuth/);
  assert.match(doc, /omnzuolrlwczvnxrvenw/);
  assert.match(doc, /Smart Restore/);
  assert.match(agents, /docs\/testing-login-contract\.md/);
});
