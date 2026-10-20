import test from "node:test";
import assert from "node:assert/strict";
import { presignGet } from "./api/_s3presign.js";

test("SigV4 presign matches the AWS documented example", () => {
  const url = presignGet({
    endpoint: "https://s3.amazonaws.com", bucket: "examplebucket", key: "test.txt",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    region: "us-east-1", expiresIn: 86400, now: new Date("2013-05-24T00:00:00Z"),
  });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
});

test("archive API never returns rows without a signed-in caller", async () => {
  const { default: handler } = await import("./api/vod-archive.js");
  let status, body; const res = { setHeader() {}, status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  await handler({ method: "GET", headers: {}, query: {} }, res);
  assert.equal(status, 401); assert.ok(!body.files);
});
