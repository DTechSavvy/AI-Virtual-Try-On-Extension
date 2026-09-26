# Engineering Guidelines & Permanent Operating Rules

**Project:** AI Virtual Try-On Chrome Extension  
**Authoritative Specification:** `AI_Virtual_Try_On_Chrome_Extension_Assignment.pdf`  
**Applicability:** Mandatory for all AI agents and engineers working on this repository.

---

## 1. Core Operating Principles

1. **Assignment Requirements Are Authoritative:**
   The assignment PDF (`AI_Virtual_Try_On_Chrome_Extension_Assignment.pdf`) is the primary specification. Never omit, reduce, or unilaterally alter required functionality. Every design decision must trace back to the assignment or be clearly documented as an implementation decision.
2. **Inspect Existing Code Before Modifying:**
   Always inspect existing files, shared types, database models, and service interfaces before authoring new logic. Never assume an implementation exists or does not exist without verifying the filesystem.
3. **Do Not Duplicate Functionality:**
   Reuse established components, services, and shared packages across the monorepo. Shared data types, enums, DTOs, and schemas belong in `/packages/shared`.
4. **Do Not Create Unnecessary Abstractions:**
   Favor clear, readable, modular implementations over speculative indirection or premature over-engineering. Abstractions are permitted only where explicitly required (e.g. `TryOnProvider` for multi-vendor AI switching).
5. **No Mock Implementations in Production Paths:**
   Never substitute mock logic or hardcoded dummy outputs in real production paths. A mock AI provider (`MockTryOnProvider`) is provided strictly for isolated automated testing and local CI environments when configured explicitly via `AI_PROVIDER=MOCK`. Real runs must invoke authentic provider workflows.
6. **Never Expose Secrets:**
   Never commit, bundle, print to logs, or hardcode API keys, passwords, database credentials, or S3 secret keys. Environment variables must be validated at boot via configuration schemas.
7. **Never Put AI Provider API Keys in the Extension:**
   All external AI provider credentials, cloud storage keys, and database connections reside strictly on the server-side backend. The Chrome extension communicates solely with the backend using authenticated session tokens.
8. **Preserve Modular Architecture:**
   Maintain strict layer boundaries:
   - Client Extension (Manifest V3 UI, Content Script, Service Worker)
   - Backend API Transport (Controllers, DTO validation)
   - Business Domain (Services, Data Normalizers)
   - Background Processing (BullMQ Queue, Job Workers)
   - Persistence (Prisma ORM, PostgreSQL, S3 Storage).
9. **Maintain Strict Type Safety:**
   Write strict TypeScript (`strict: true`). Avoid `any` types wherever possible. Share domain models and API contracts between the backend and extension via `@vton/shared`.
10. **Validate All External Input:**
    All incoming network requests, uploaded files, and DOM-extracted data must undergo runtime validation using Zod or class-validator. Uploaded images must undergo magic-byte verification and dimensional clamping.
11. **Handle Errors Explicitly:**
    Never swallow exceptions or use empty `catch` blocks. Return standardized RFC 7807 problem details from API endpoints and present friendly, actionable error messages in the extension UI.
12. **Security & Privacy Requirements Are Mandatory:**
    - Personal photos are sensitive data and must never be exposed publicly.
    - Cloud storage must be private; generate short-lived pre-signed URLs only.
    - Support complete profile and account deletion with physical storage blob purging.
    - Never use personal photos for model training without explicit consent.
13. **Maintain Accurate Documentation:**
    Whenever architecture, API contracts, database schemas, or extension permissions evolve, update the corresponding documents in `/docs/` immediately.
14. **Avoid Website-Specific Hard-Coding:**
    The product detection engine must remain primarily generic, relying on standard semantic structures (JSON-LD, OpenGraph, DOM image heuristics, standard pricing). Website-specific adapters are permitted only as supplementary extensions and must never compromise the generic engine.
15. **Prefer Reusable Components:**
    Build modular, reusable UI components for the Side Panel. The digital profile must be reusable across multiple products without repeated uploads.
16. **Do Not Silently Remove Required Functionality:**
    Never delete required features or reduce the scope of the system to achieve an artificial build pass.
17. **Do Not Claim Completion Without Verification:**
    Never report a task as complete without executing the relevant build, typecheck, unit test, or integration command.
18. **Run Build / Typecheck / Lint After Meaningful Changes:**
    Execute `npm run typecheck` and verify clean builds before completing any major milestone.
19. **Report Remaining Limitations Honestly:**
    Always disclose known technical limitations, external provider constraints, or pending tasks openly and transparently in reports.
