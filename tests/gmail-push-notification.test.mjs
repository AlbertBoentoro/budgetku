import test from "node:test";
import assert from "node:assert/strict";
import { readGmailNotification, inspectGmailNotification } from "../lib/gmail/push-notification.ts";
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
test("malformed payloads and unsafe numeric IDs are rejected", () => {
  for (const value of [null, {}, {subscription,message:{data:"bad!"}},payload({emailAddress:"test@example.com",historyId:9007199254740992}),payload({emailAddress:"bad",historyId:"123"})]) {
    assert.equal(readGmailNotification(value, subscription), null);
  }
});

test("safe numeric history ID is normalized to a string", () => {
  assert.deepEqual(readGmailNotification(payload({emailAddress:"test@example.com",historyId:123}),subscription),
    {emailAddress:"test@example.com",historyId:"123"});
});
test("negative and fractional history IDs are rejected", () => {
  for (const historyId of [-1,1.5]) assert.equal(readGmailNotification(payload({emailAddress:"test@example.com",historyId}),subscription),null);
});
test("rejection reason contains no mailbox information", () => {
  assert.deepEqual(inspectGmailNotification(payload({emailAddress:"private@example.com",historyId:"123"},"wrong"),subscription),{ok:false,reason:"subscription"});
  assert.deepEqual(inspectGmailNotification(payload({emailAddress:"private@example.com",historyId:null}),subscription),{ok:false,reason:"history_id"});
});
test("unpadded base64url payload is supported", () => {
  const data = Buffer.from(JSON.stringify({emailAddress:"test@example.com",historyId:"123"})).toString("base64url");
  assert.deepEqual(readGmailNotification({subscription,message:{data}},subscription),{emailAddress:"test@example.com",historyId:"123"});
});
