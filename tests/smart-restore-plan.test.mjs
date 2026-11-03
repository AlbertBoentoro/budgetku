import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createSmartRestorePlan, selectedRestoreImpact } from "../lib/settings/smart-restore-plan.mjs";

function fixture() {
  const userId = randomUUID(), accountId = randomUUID(), categoryId = randomUUID();
  const old = {
    id: randomUUID(), user_id: userId, account_id: accountId,
    destination_account_id: null, category_id: categoryId,
    transaction_type: "expense", amount: 35000,
    currency: "IDR", source: "manual", source_reference: null,
    transaction_at: "2026-11-02T12:00:00Z",
    merchant: "Lunch", description: "Lunch",
    created_at: "2026-11-02T12:00:00Z", updated_at: "2026-11-02T12:00:00Z",
  };
  const current = {
    data: {
      transactions: [{ ...old, id: randomUUID(), amount: 45000, transaction_at: "2026-11-03T12:00:00Z" }],
      accounts: [{ id: accountId, user_id: userId, name: "BCA", currency: "IDR", is_archived: false }],
      categories: [{ id: categoryId, user_id: userId, category_type: "expense", is_archived: false }],
    },
  };
  const incoming = { format: "budgetku-backup", version: 1,
    data: { ...structuredClone(current.data), transactions: [old] } };
  return { userId, accountId, categoryId, old, current, incoming };
}
describe("Smart Restore selection safety", () => {
  it("keeps today's transactions and offers yesterday's missing row, unchecked", () => {
    const f = fixture(), result = createSmartRestorePlan(f);
    assert.equal(result.eligibleCount, 1);
    assert.deepEqual(result.defaultSelectedIds, []);
    assert.equal(result.candidates[0].id, f.old.id);
    assert.deepEqual(selectedRestoreImpact(result.candidates,[f.old.id]).accountChanges,
      [{accountId:f.accountId,name:"BCA",delta:-35000}]);
  });
  it("never selects or overwrites existing IDs", () => {
    const f = fixture(); f.current.data.transactions.push({...f.old});
    const r = createSmartRestorePlan(f);
    assert.equal(r.candidates.length,0);assert.equal(r.alreadyPresent,1);
  });
  it("blocks Gmail and source-reference transactions", () => {
    const f=fixture();f.old.source="gmail";
    assert.equal(createSmartRestorePlan(f).candidates[0].eligible,false);
    f.old.source="manual";f.old.source_reference="initial-recurring:key";
    assert.equal(createSmartRestorePlan(f).candidates[0].eligible,false);
  });
  it("blocks missing or archived account and category", () => {
    const f=fixture();f.current.data.accounts[0].is_archived=true;
    assert.equal(createSmartRestorePlan(f).eligibleCount,0);
    f.current.data.accounts[0].is_archived=false;f.current.data.categories=[];
    assert.equal(createSmartRestorePlan(f).eligibleCount,0);
  });
  it("rejects foreign-user / duplicate records", () => {
    const f=fixture();f.old.user_id=randomUUID();
    assert.throws(()=>createSmartRestorePlan(f),/ownership/);
    f.old.user_id=f.userId;f.incoming.data.transactions.push({...f.old});
    assert.throws(()=>createSmartRestorePlan(f),/duplicate/);
  });
  it("blocks invalid amounts, transfer destinations and unknown types", () => {
    const f=fixture(); f.old.amount=NaN;
    assert.equal(createSmartRestorePlan(f).eligibleCount,0);
    f.old.amount=35000; f.old.transaction_type="transfer";
    f.old.category_id=null; f.old.destination_account_id=f.old.account_id;
    assert.equal(createSmartRestorePlan(f).eligibleCount,0);
    f.old.transaction_type="invalid";
    assert.equal(createSmartRestorePlan(f).eligibleCount,0);
  });
  it("rejects invalid selection and supports net-zero transfers", () => {
    const f=fixture(), plan=createSmartRestorePlan(f);
    assert.throws(()=>selectedRestoreImpact(plan.candidates,[f.old.id,f.old.id]),/selection/);
    assert.throws(()=>selectedRestoreImpact(plan.candidates,[randomUUID()]),/cannot be restored/);
    f.old.transaction_type="transfer";f.old.category_id=null;
    const target=randomUUID();f.old.destination_account_id=target;
    f.current.data.accounts.push({id:target,user_id:f.userId,name:"Cash",currency:"IDR",is_archived:false});
    const transfer=createSmartRestorePlan(f).candidates;
    assert.deepEqual(selectedRestoreImpact(transfer,[f.old.id]).accountChanges,
      [{accountId:f.accountId,name:"BCA",delta:-35000},{accountId:target,name:"Cash",delta:35000}]);
  });
});
