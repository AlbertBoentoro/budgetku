import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isProductionSmartRestoreAllowed, isStagingSmartRestoreAllowed,
  isSmartRestoreAllowed } from "../lib/settings/smart-restore-guard.ts";
const KEYS=["VERCEL_ENV","NEXT_PUBLIC_SUPABASE_URL","BUDGETKU_STAGING_E2E",
  "STAGING_PROJECT_REF","STAGING_SUPABASE_URL"];
function withEnv(values,verify) {
  const old=Object.fromEntries(KEYS.map(k=>[k,process.env[k]]));
  try {
    for (const key of KEYS) {
      if (Object.hasOwn(values,key)) process.env[key]=values[key];
      else delete process.env[key];
    }
    verify();
  } finally {
    for (const key of KEYS) {
      if (old[key]===undefined) delete process.env[key];
      else process.env[key]=old[key];
    }
  }
}
const stage="https://omnzuolrlwczvnxrvenw.supabase.co";
const prod="https://zvmqrrttdrqkyrdzyxlf.supabase.co";
describe("Smart Restore environment gates",()=>{
  it("enables exact production URL only on Vercel production",()=>{
    withEnv({VERCEL_ENV:"production", NEXT_PUBLIC_SUPABASE_URL:prod},()=>{
      assert.equal(isProductionSmartRestoreAllowed(),true);
      assert.equal(isSmartRestoreAllowed(),true);
      assert.equal(isStagingSmartRestoreAllowed(),false);
    });
  });
  it("rejects production URL in preview/local, wrong database and near-match spoof",()=>{
    for(const env of ["preview","development",undefined]){
      withEnv({VERCEL_ENV:env,NEXT_PUBLIC_SUPABASE_URL:prod},()=>{
        assert.equal(isSmartRestoreAllowed(),false);
      });
    }
    withEnv({VERCEL_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:stage,
      BUDGETKU_STAGING_E2E:"true",STAGING_PROJECT_REF:"omnzuolrlwczvnxrvenw",STAGING_SUPABASE_URL:stage},()=>{
      assert.equal(isSmartRestoreAllowed(),false);
    });
    withEnv({VERCEL_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:prod+"/"},()=>{
      assert.equal(isSmartRestoreAllowed(),false);
    });
  });
  it("allows only the dedicated explicit staging test process",()=>{
    withEnv({NEXT_PUBLIC_SUPABASE_URL:stage,STAGING_SUPABASE_URL:stage,
      BUDGETKU_STAGING_E2E:"true",STAGING_PROJECT_REF:"omnzuolrlwczvnxrvenw"},()=>{
      assert.equal(isSmartRestoreAllowed(),true);
      assert.equal(isProductionSmartRestoreAllowed(),false);
    });
    withEnv({NEXT_PUBLIC_SUPABASE_URL:stage,STAGING_SUPABASE_URL:stage,
      BUDGETKU_STAGING_E2E:"true",STAGING_PROJECT_REF:"zvmqrrttdrqkyrdzyxlf"},()=>{
      assert.equal(isSmartRestoreAllowed(),false);
    });
  });
});
