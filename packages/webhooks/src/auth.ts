import crypto from "node:crypto";

export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify a bearer token from either the Authorization header or x-webhook-token header.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param authHeader - The Authorization header value (e.g. "Bearer <token>")
 * @param xWebhookToken - The x-webhook-token header value
 * @param expectedToken - The expected token to compare against. If empty, auth is skipped.
 */
export function verifyBearerToken(
  authHeader: string | null,
  xWebhookToken: string | null,
  expectedToken: string,
): SignatureVerificationResult {
  if (!expectedToken) {
    return { valid: true };
  }

  if (!authHeader && !xWebhookToken) {
    return { valid: false, error: "Missing bearer or webhook token header" };
  }

  const candidate = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;
  const candidateFromHeader = xWebhookToken || candidate;

  if (!candidateFromHeader) {
    return {
      valid: false,
      error: "Missing Authorization or x-webhook-token header",
    };
  }

  if (candidateFromHeader.length !== expectedToken.length) {
    return { valid: false, error: "Invalid token" };
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(candidateFromHeader),
    Buffer.from(expectedToken),
  );

  if (!isValid) {
    return { valid: false, error: "Invalid token" };
  }

  return { valid: true };
}

export function verifyHmacSha256Signature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): SignatureVerificationResult {
  if (!signature) {
    return { valid: false, error: "Missing signature header" };
  }

  if (!secret) {
    return { valid: false, error: "Webhook secret not configured" };
  }

  const signaturePrefix = "sha256=";
  const providedSignature = signature.startsWith(signaturePrefix)
    ? signature.slice(signaturePrefix.length)
    : signature;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSignature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

export function verifyTimestamp(
  timestampHeader: string | null,
  maxAgeSeconds: number = 300,
): SignatureVerificationResult {
  if (!timestampHeader) {
    return { valid: false, error: "Missing timestamp header" };
  }

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);

  if (diff > maxAgeSeconds) {
    return {
      valid: false,
      error: `Timestamp too old (${diff}s > ${maxAgeSeconds}s)`,
    };
  }

  return { valid: true };
}

export function verifySlackStyleSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string,
  version: string = "v0",
): SignatureVerificationResult {
  const timestampResult = verifyTimestamp(timestamp);
  if (!timestampResult.valid) {
    return timestampResult;
  }

  if (!signature) {
    return { valid: false, error: "Missing signature header" };
  }

  if (!secret) {
    return { valid: false, error: "Webhook secret not configured" };
  }

  const signatureBase = `${version}:${timestamp}:${payload}`;
  const expectedSignature = `${version}=${crypto
    .createHmac("sha256", secret)
    .update(signatureBase)
    .digest("hex")}`;

  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: "Invalid signature" };
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

export function verifyGiteaWebhook(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): SignatureVerificationResult {
  if (!secret) {
    return { valid: true };
  }

  if (!signatureHeader) {
    return { valid: false, error: "Missing X-Hub-Signature-256 header" };
  }

  return verifyHmacSha256Signature(payload, signatureHeader, secret);
}
