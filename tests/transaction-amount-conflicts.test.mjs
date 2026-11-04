import test from "node:test";
import assert from "node:assert/strict";
import { createAmountConflict } from "../lib/settings/transaction-amount-conflicts.mjs";

const USER = "11111111-2222-4333-8444-555555555555";
const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ACCOUNT = "99999999-1111-4222-8333-444444444444";
const CAT = "22222222-3333-4444-8555-666666666666";
const original = {
  id:ID, user_id:USER, account_id:ACCOUNT, destination_account_id:null,
  category_id:CAT, transaction_type:"expense", amount:100000,
  merchant:"Belanja", description:"Catatan lama", currency:"IDR",
  source:"manual", source_reference:null,
  transaction_at:"2026-11-04T05:00:00Z",
  created_at:"2026-11-04T05:10:00Z", updated_at:"2026-11-04T05:10:00Z",
};
const current = { ...original, amount:150000, updated_at:"2026-11-04T05:15:00Z" };

test("same ID, amount-only conflict gives both values without altering either", () => {
  const result = createAmountConflict(original,current,USER);
  assert.equal(result.id,ID);
  assert.equal(result.savedAmount,100000);
  assert.equal(result.currentAmount,150000);
  assert.equal(result.currentUpdatedAt,"2026-11-04T05:15:00Z");
  assert.equal(current.amount,150000);
});
test("unchanged amount and different IDs are not conflicts", () => {
  assert.equal(createAmountConflict(current,current,USER),null);
  assert.equal(createAmountConflict(original,{...current,id:"bbbbbbbb-cccc-4ddd-8eee-ffffffffffff"},USER),null);
});
test("reject foreign owners and non-manual records", () => {
  assert.equal(createAmountConflict(original,current,"00000000-1111-4222-8333-444444444444"),null);
  assert.equal(createAmountConflict(original,{...current,source:"email"},USER),null);
});
test("do not offer amount-only recovery if other financial or descriptive fields changed", () => {
  for (const [field,value] of Object.entries({
    account_id:"77777777-3333-4444-8555-666666666666",
    category_id:null,transaction_type:"income",
    merchant:"New shop",description:"Different note",
    transaction_at:"2026-11-05T05:00:00Z",
  })) {
    assert.equal(createAmountConflict(original,{...current,[field]:value},USER),null,field);
  }
});
test("reject malformed/unsafe amounts", () => {
  assert.equal(createAmountConflict({...original,amount:-1},current,USER),null);
  assert.equal(createAmountConflict({...original,amount:1.25},current,USER),null);
  assert.equal(createAmountConflict(original,{...current,amount:Number.MAX_SAFE_INTEGER},USER),null);
});
