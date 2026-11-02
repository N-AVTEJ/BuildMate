---
description: Enforces Razorpay and RBI payment aggregator compliance guardrails for UI copy and marketing
globs: ["src/app/**/*", "src/components/**/*"]
---

# Razorpay & Payment Gateway Compliance Guardrails

## 1. Customer-Facing Terminology Restrictions
When authoring or modifying public marketing surfaces, landing pages, banners, checkout buttons, or user dashboards:
- **Forbidden Terms**: Do NOT use `escrow`, `escrow account`, `escrow architecture`, `advance deposit holding`, or `30% escrow protection`.
- **Compliant Terms**: Use standard SaaS milestone language:
  - `Milestone-based Project Delivery`
  - `Initial Milestone Payment` / `Final Milestone Settlement`
  - `Phase-wise Milestone Verification`
  - `Verified Milestone Delivery Gate`
- **Gateway Identification**: Avoid presenting the gateway as an escrow agent or custodial trustee. Refer to payment flows as "Secure Checkout" or "Gateway Verification".

## 2. Business Logic Invariant
- Do NOT alter or remove backend calculations, database columns (`advance_amount`, `remaining_amount`, `total_price`), API endpoints (`/api/razorpay/*`, `/api/payments/*`), or status transitions.
- The 30% calculation and milestone phase locking remain active in backend code; only customer-facing labels are framed as initial and final milestones.
