import test from "node:test";
import assert from "node:assert/strict";
import { readGmailNotification } from "../lib/gmail/push-notification.ts";
const subscription = "projects/demo/subscriptions/test";
function payload(value, sub = subscription) {
  return { subscription: sub, message: { data: Buffer.from(JSON.stringify(value)).toString("base64") } };
}
test("valid Gmail push preserves large history IDs as strings", () => {
  assert.deepEqual(readGmailNotification(payload({ emailAddress: "TEST@example.com", historyId: "90071992547409999" }), subscription),
    { emailAddress: "test@example.com", historyId: "90071992547409999" });
});
test("wrong subscription is rejected", () => {
  assert.equal(readGmailNotification(payload({emailAddress:"test@example.com",historyId:"123"}, "projects/wrong/subscriptions/test"),subscription),null);
});
test("malformed payloads and numeric IDs are rejected", () => {
  for (const value of [null, {}, {subscription,message:{data:"bad!"}},payload({emailAddress:"test@example.com",historyId:123}),payload({emailAddress:"bad",historyId:"123"})]) {
    assert.equal(readGmailNotification(value, subscription), null);
  }
});
