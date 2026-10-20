import crypto from "node:crypto";

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

// AWS SigV4 query-string presign for a GET (virtual-host style). No SDK dependency.
export function presignGet({ endpoint, bucket, key, accessKeyId, secretAccessKey, region = "auto", expiresIn = 900, filename, now = new Date() }) {
  const base = new URL(endpoint);
  const host = `${bucket}.${base.host}`;
  const path = "/" + String(key).split("/").map(enc).join("/");
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const params = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(Math.min(Math.max(1, expiresIn | 0), 604800)),
    "X-Amz-SignedHeaders": "host",
  };
  if (filename) params["response-content-disposition"] = `attachment; filename="${String(filename).replace(/[^\w.\-]/g, "_")}"`;
  const query = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join("&");
  const canonical = ["GET", path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac("AWS4" + secretAccessKey, day), region), "s3"), "aws4_request");
  const sig = crypto.createHmac("sha256", kSigning).update(toSign).digest("hex");
  return `${base.protocol}//${host}${path}?${query}&X-Amz-Signature=${sig}`;
}
