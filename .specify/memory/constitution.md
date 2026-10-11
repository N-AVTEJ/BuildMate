<!--
Sync Impact Report:
- Version change: Initial Template -> 1.0.0
- Principles defined:
  - PRINCIPLE_1: I. Architectural Integrity & Next.js App Router Conventions
  - PRINCIPLE_2: II. Defense-in-Depth Security & Strict Authorization
  - PRINCIPLE_3: III. Database Integrity, Schema Discipline & State Invariants
  - PRINCIPLE_4: IV. Invariant Testing & Automated Verification (NON-NEGOTIABLE)
  - PRINCIPLE_5: V. Reliability, Maintainability & Operational Observability
- Added sections:
  - Technology Stack & Architectural Constraints
  - Development Workflow & Quality Gates
- Removed sections: None
- Follow-up TODOs: None
-->

# BuildMate Constitution

## Core Principles

### I. Architectural Integrity & Next.js App Router Conventions
BuildMate is structured around Next.js 16 (App Router), React 19, and TypeScript. All changes MUST adhere to established directory boundaries:
- `src/app`: Page routing, layouts, server-side data loaders, and API route handlers only. UI rendering and route handlers MUST NOT contain raw database queries or direct cross-boundary side effects.
- `src/components`: Modular, reusable presentation components utilizing Tailwind CSS tokens. Components MUST NOT bypass domain business logic.
- `src/lib`: Core domain services, authorization policies, credential cryptography, storage abstractions, and external integrations.
- `src/db`: Drizzle ORM schema definitions, relationship maps, and connection pooling clients.
- Next.js-Specific Guardrails: Next.js 16 conventions and breaking changes MUST be respected as documented in `AGENTS.md` and `node_modules/next/dist/docs/`. Developers and AI agents MUST NOT remove the Next.js agent block in `AGENTS.md`.

### II. Defense-in-Depth Security & Strict Authorization
Security is non-negotiable across every surface of BuildMate. The application enforces a strict deny-by-default posture:
- Centralized Authorization Matrix: Every route handler and sensitive mutation MUST explicitly invoke the centralized authorization engine via `can(session, action, context)` defined in `src/lib/authorization.ts`.
- Tenant & Resource Isolation: Multi-role permissions (`CLIENT`, `BUILDER`, `ADMIN`) and resource ownership MUST be verified on every request to prevent Insecure Direct Object References (IDOR).
- Sensitive Data & Asset Protection: Passwords MUST be hashed using Argon2 with verified complexity standards. File uploads and deliverable downloads MUST route through secure S3 presigned or signed verification channels (`src/lib/storage.ts`). Deliverables MUST remain locked until payment verification criteria are completely satisfied.
- Abuse Protection: Sensitive endpoints (authentication, public inquiries, file generation) MUST apply rate limiting via Upstash Redis.

### III. Database Integrity, Schema Discipline & State Invariants
PostgreSQL managed via Drizzle ORM (`src/db/schema.ts`) is the authoritative source of truth:
- Explicit Enum & State Machine Discipline: All project states, payment statuses, and user roles are strictly governed by PostgreSQL enums. Direct status overrides without validation are prohibited. State transitions MUST be recorded in `project_status_history`.
- Transactional Consistency: Multi-step lifecycle updates (such as updating project status, appending status history, recording audit entries, and queueing notifications) MUST execute inside database transactions (`txOrDb` pattern).
- Non-destructive Schema Evolution: Active database enums and production tables MUST NOT be modified or dropped without tested forward-compatible migration strategies.
- Non-User Actor Attribution: System-triggered transitions and scheduled automations MUST utilize the dedicated system actor (`SYSTEM_ACTOR_ID`) to guarantee foreign key integrity without falsifying user actions.

### IV. Invariant Testing & Automated Verification (NON-NEGOTIABLE)
Code is not complete until verified by automated tests:
- Test-First or Regression-Guaranteed: Any bug fix, workflow modification, or new feature MUST include automated Vitest tests in `src/tests/`.
- Invariant & Security Test Coverage: The core test suites (`security.test.ts`, `storage.test.ts`, `ux-portal.test.ts`, `workflow-audit.test.ts`) assert system-wide invariants. No code may be merged if any invariant or security suite fails.
- Environment Isolation: Test execution runs against isolated test configurations defined in `vitest.config.ts` without polluting production or development state.

### V. Reliability, Maintainability & Operational Observability
The codebase must remain robust, predictable, and easy to maintain over time:
- Predictable Error Handling: Errors MUST use typed domain error representations (e.g., `AuthError`) and return standardized JSON error payloads. Sensitive internal stack traces MUST NEVER be leaked to clients.
- Strict Type Safety: Code MUST strictly pass TypeScript compilation (`tsc --noEmit`) without unconstrained `any` casts or suppressed linter warnings.
- Developer Experience & Lifecycle Scripts: Local development prerequisites and database readiness MUST remain automated and deterministic via utility scripts (e.g., `scripts/ensure-db.js`).

## Technology Stack & Architectural Constraints

BuildMate is engineered with the following baseline stack and operational constraints:
- Framework: Next.js 16.3+ (App Router), React 19.2+, TypeScript 5+.
- Styling: Tailwind CSS v4 configured via `@tailwindcss/postcss`.
- Persistence & ORM: PostgreSQL (port 5433 local instance), Drizzle ORM (`drizzle-orm`, `drizzle-kit`) with `prepare: false` configured for transaction pooler compatibility.
- Authentication & Identity: Argon2 password hashing, secure HTTP-only cookie session handling, multi-role access control (`CLIENT`, `BUILDER`, `ADMIN`).
- Storage Engine: AWS S3 client (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) with seamless local memory mock fallback for testing and offline development.
- External Integrations: Upstash Redis for rate limiting, Resend for email notifications.
- Test Runner: Vitest 5+ with node environment configuration.

## Development Workflow & Quality Gates

All contributions to BuildMate MUST pass through the following quality gates prior to merging:
1. Static Analysis & Type Checking: `npm run lint` and TypeScript compilation MUST pass with zero errors.
2. Invariant & Regression Verification: `npm run test` (Vitest) MUST execute and pass all suites.
3. Database Migration Guard: Any modification to `src/db/schema.ts` MUST generate a corresponding migration via `drizzle-kit` and be tested against a clean database instance.
4. Next.js Guardrail Preservation: Any workspace sync or agent execution MUST preserve the Next.js agent block in `AGENTS.md`.

## Governance

This Constitution represents the supreme technical governance for the BuildMate project. All future specifications, architectural decisions, and pull requests MUST comply with these principles.

- Amendment Procedure: Amendments to this Constitution require documented justification, an impact review, and an explicit version increment according to semantic versioning:
  - MAJOR: Removal, restructuring, or fundamental weakening of existing principles.
  - MINOR: Addition of new principles or material expansions of architectural guidance.
  - PATCH: Clarifications, typographical corrections, or non-semantic refinements.
- Compliance Review: Code reviews and AI agent plans MUST explicitly reference compliance with these principles. Unjustified deviations MUST be rejected.

**Version**: 1.0.0 | **Ratified**: 2026-10-11 | **Last Amended**: 2026-10-11
