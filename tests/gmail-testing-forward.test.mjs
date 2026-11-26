import test from "node:test";
import assert from "node:assert/strict";
import { readTestingForward, testingForwardEnabled } from "../lib/gmail/testing-forward.ts";
const env = {VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feat/gmail-push-sync",NEXT_PUBLIC_SUPABASE_URL:"https://omnzuolrlwczvnxrvenw.supabase.co"};
const body = (from, subject, receipt, marker="---------- Forwarded message ---------") =>
  ["Ignore this comment Rp999999",marker,"From: "+from,"Date: Thu, Nov 26, 2026","Subject: "+subject,"To: test@example.com","",receipt].join("\n");
test("forward gate requires staging database, preview and designated branch",()=>{
  assert.equal(testingForwardEnabled(env),true);
  for(const patch of [{VERCEL_ENV:"production"},{VERCEL_GIT_COMMIT_REF:"main"},{NEXT_PUBLIC_SUPABASE_URL:"https://production.supabase.co"}])
    assert.equal(testingForwardEnabled({...env,...patch}),false);
});
test("Grab forwarded receipt retains only original receipt body",()=>{
  assert.deepEqual(readTestingForward("Fwd: Your Grab E-Receipt",body("Grab <no-reply@grab.com>","Your Grab E-Receipt","Your Trip\nTotal Paid Rp20.000"),true),{from:"no-reply@grab.com",subject:"Your Grab E-Receipt",bodyText:"Your Trip\nTotal Paid Rp20.000"});
});
test("BCA forwarded receipt is supported",()=>{
  assert.equal(readTestingForward("FW: Internet Transaction Journal",body("BCA <bca@bca.co.id>","Internet Transaction Journal","Amount IDR 20,000.00"),true)?.from,"bca@bca.co.id");
});
test("production and unknown, mismatched or lookalike headers fail closed",()=>{
  const subject="Fwd: Your Grab E-Receipt";
  const valid=body("no-reply@grab.com","Your Grab E-Receipt","Total Paid Rp20.000");
  assert.equal(readTestingForward(subject,valid,false),null);
  assert.equal(readTestingForward(subject,valid.replace("grab.com","grab.com.evil.example"),true),null);
  assert.equal(readTestingForward(subject,valid.replace("Subject: Your Grab E-Receipt","Subject: Other"),true),null);
  assert.equal(readTestingForward(subject,valid.replace("---------- Forwarded message ---------","arbitrary text"),true),null);
  assert.equal(readTestingForward("Your Grab E-Receipt",valid,true)?.from,"no-reply@grab.com");
  assert.equal(readTestingForward("Your Grab E-Receipt",valid,false),null);
});

test("actual BCA forwarded subject without Fwd prefix is supported only in staging",()=>{
  const subject="Internet Transaction Journal";
  const fixture=body("BCA <bca@bca.co.id>",subject,"Transaction Type: Flazz Top Up\nTop Up Amount: IDR 20,000.00");
  assert.equal(readTestingForward(subject,fixture,true)?.from,"bca@bca.co.id");
  assert.equal(readTestingForward(subject,fixture,false),null);
  assert.equal(readTestingForward(subject,"Transaction Type: Flazz Top Up",true),null);
});
