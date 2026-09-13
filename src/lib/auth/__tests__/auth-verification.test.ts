import assert from "node:assert";
import {
  validatePasswordComplexity,
  hashPassword,
  verifyPassword,
  dummyVerifyPassword,
} from "../password";
import { hashToken } from "../session";
import { getClientIp, rateLimit } from "../rate-limit";

async function runTests() {
  console.log("=== BuildMate Phase 2 Auth Verification Tests ===");

  // 1. Password complexity tests
  console.log("1. Testing password complexity validation...");
  assert.strictEqual(validatePasswordComplexity("short").valid, false);
  assert.strictEqual(validatePasswordComplexity("alllowercase1!").valid, false);
  assert.strictEqual(validatePasswordComplexity("ALLUPPERCASE1!").valid, false);
  assert.strictEqual(validatePasswordComplexity("NoSpecialOrNumber").valid, false);
  assert.strictEqual(validatePasswordComplexity("ValidPass123!").valid, true);
  console.log("  ✓ Password complexity tests passed");

  // 2. Argon2id password hashing and verification
  console.log("2. Testing Argon2id password hashing and verification...");
  const rawPass = "SecureP@ssw0rd2026!";
  const hash = await hashPassword(rawPass);
  assert.ok(hash.startsWith("$argon2id$"), "Hash must be Argon2id");
  assert.strictEqual(await verifyPassword(hash, rawPass), true);
  assert.strictEqual(await verifyPassword(hash, "WrongPassword123!"), false);
  console.log("  ✓ Argon2id hash and verify tests passed");

  // 3. Timing-equalized dummy password verification
  console.log("3. Testing timing-equalized dummy password verification...");
  const dummyRes = await dummyVerifyPassword("arbitraryPassword");
  assert.strictEqual(dummyRes, false, "Dummy verify must always return false");
  console.log("  ✓ Dummy verification test passed");

  // 4. Token hashing (SHA-256)
  console.log("4. Testing SHA-256 token hashing...");
  const token = "my-secret-opaque-token-12345";
  const tokenHash = hashToken(token);
  assert.strictEqual(tokenHash.length, 64, "SHA-256 hash must be 64 hex characters");
  assert.strictEqual(tokenHash, hashToken(token), "Hash must be deterministic");
  assert.notStrictEqual(tokenHash, token, "Raw token must not match hash");
  console.log("  ✓ Token hashing tests passed");

  // 5. Trusted-proxy IP extraction
  console.log("5. Testing trusted-proxy IP extraction...");
  // In development, always 127.0.0.1
  const fakeDevReq = new Request("http://localhost:3000", {
    headers: { "x-forwarded-for": "10.0.0.1" },
  });
  assert.strictEqual(getClientIp(fakeDevReq), "127.0.0.1");

  // Simulate production environment
  const originalEnv = process.env.NODE_ENV;
  try {
    (process.env as any).NODE_ENV = "production";
    const prodReqWithRealIp = new Request("http://localhost:3000", {
      headers: { "x-real-ip": "203.0.113.195" },
    });
    assert.strictEqual(getClientIp(prodReqWithRealIp), "203.0.113.195");

    const prodReqWithForwarded = new Request("http://localhost:3000", {
      headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.2" },
    });
    assert.strictEqual(getClientIp(prodReqWithForwarded), "198.51.100.1");
  } finally {
    (process.env as any).NODE_ENV = originalEnv;
  }
  console.log("  ✓ Trusted-proxy IP extraction tests passed");

  // 6. Rate Limiter test
  console.log("6. Testing sliding-window rate limiting helper...");
  const testKey = `test:ip:${Date.now()}`;
  const r1 = await rateLimit(testKey, 3, "1 m");
  assert.strictEqual(r1.success, true);
  assert.strictEqual(r1.remaining, 2);

  const r2 = await rateLimit(testKey, 3, "1 m");
  assert.strictEqual(r2.success, true);
  assert.strictEqual(r2.remaining, 1);

  const r3 = await rateLimit(testKey, 3, "1 m");
  assert.strictEqual(r3.success, true);
  assert.strictEqual(r3.remaining, 0);

  // 4th request exceeds limit of 3
  const r4 = await rateLimit(testKey, 3, "1 m");
  assert.strictEqual(r4.success, false, "4th request must exceed limit of 3");
  assert.strictEqual(r4.remaining, 0);
  console.log("  ✓ Rate limiting test passed");

  console.log("=== All Phase 2 Auth Verification Tests Passed Successfully! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
