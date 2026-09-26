# Technology Decisions & Architectural Rationale

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** Technology Architecture Specification  

---

## 1. Overview & Decision Framework

The technology stack is selected based on five objective engineering criteria derived from the assignment specifications:
1. **Assignment Fidelity:** Fully satisfies Manifest V3, cross-site compatibility, asynchronous AI pipelines, and strict security/privacy requirements.
2. **Type Safety Across Tiers:** Shared TypeScript interfaces between extension, backend, and background workers to eliminate contract drift.
3. **Operational Simplicity:** A clear local development experience with zero cloud dependencies required for local testing (via MinIO and Mock AI Provider).
4. **Production Scalability:** Asynchronous job processing decoupled from HTTP request loops.
5. **No Architectural Over-Engineering:** Avoid microservice sprawl or excessive abstractions where a clean modular monolith provides superior reliability, performance, and developer velocity.

---

## 2. Technology Selection Matrix

| Component | Selected Technology | Evaluated Alternatives | Rationale & Tradeoff Analysis |
|---|---|---|---|
| **Chrome Extension Framework** | **Chrome Manifest V3 + React 19 + TypeScript + Vite** | Plasmo, WXT, Vanilla JS | Vite + React provides instant HMR, tiny bundle footprints, modern JSX component ergonomics, and complete control over the Manifest V3 build process without opaque framework magic. |
| **Extension UI Paradigm** | **Chrome Side Panel API (`chrome.sidePanel`)** | Popup only, Full Content Script Injected Overlay | The side panel remains persistently open while the user scrolls, navigates between product listing and detail pages, and changes tabs. Popup menus vanish on outside clicks, breaking try-on progress tracking. |
| **Backend Runtime & Language** | **Node.js (LTS v22) + TypeScript** | Python (FastAPI), Go | Full-stack TypeScript allows 100% type sharing (Product models, API contracts, Enums, DTOs) between the Chrome extension and the backend service, minimizing contract errors. |
| **Backend Architecture** | **Modular Express / Fastify with Dependency Injection** | NestJS, Django, Spring Boot | Clean modular architecture with lightweight dependency injection provides maximum transparency, rapid boot times, low memory overhead, and straightforward containerization without NestJS decorator bloat. |
| **Database Engine** | **PostgreSQL 16** | MongoDB, MySQL, DynamoDB | Relational integrity with foreign key cascading deletes is critical for privacy compliance (GDPR Right to Erasure). Structured indexing enables fast lookups by user, profile, product, and job status. |
| **ORM / Data Access** | **Prisma ORM** | TypeORM, Drizzle, Raw SQL | Type-safe query generation directly aligned with TypeScript models, automated migration tooling, and declarative relational mapping. |
| **Job Queue & Caching** | **BullMQ + Redis 7** | RabbitMQ, AWS SQS, DB Polling | BullMQ provides battle-tested job queuing, status monitoring, retries with exponential backoff, worker concurrency, and delayed tasks with sub-millisecond latency. |
| **Object Storage** | **S3-Compatible Storage (MinIO dev / AWS S3 prod)** | Storing Blobs in PostgreSQL, Local Disk | Large images must never bloat relational database tables. S3-compatible APIs enable native pre-signed URL generation, ensuring zero public exposure while allowing identical code locally (via MinIO) and in cloud production. |
| **Image Processing** | **Sharp (libvips)** | Jimp, ImageMagick | Sharp is up to 5x faster than ImageMagick and 8x faster than Jimp, offering memory-safe C/C++ native acceleration for WebP conversion, auto-orientation, EXIF stripping, and aspect-ratio padding. |
| **CSS & Design System** | **Tailwind CSS + Glassmorphism / Modern Tokens** | Bootstrap, Vanilla CSS only | Provides a modern, dark/light aware, sleek aesthetic with design tokens, responsive layout primitives, and rapid styling without CSS namespace collisions. |
| **Monorepo Management** | **npm Workspaces** | Turborepo, Nx, Lerna | Native to Node.js / npm, zero extra CLI dependencies, simple setup for linking shared packages between `extension` and `backend`. |

---

## 3. AI Virtual Try-On Provider Strategy

In strict adherence to Assignment Section 7, 8, and 13:
- **Primary Live Provider Options:**
  - **FASHN.ai:** Industry-standard specialized virtual try-on API supporting upper-body, lower-body, and dresses with photorealistic garment inpainting and body alignment.
  - **Replicate (IDM-VTON / CatVTON):** Open-source high-fidelity virtual try-on diffusion models hosted on serverless GPUs.
  - **Google Cloud Vertex AI (Imagen 3):** Foundation model for context-aware background generation and clothing replacement.
- **Local / Test Provider:**
  - **`MockTryOnProvider`:** Synthesizes realistic try-on results by compositing and blending product features onto profile images with realistic processing delays (3s) for offline testing, CI automation, and local evaluation without requiring paid cloud API keys.
- **Provider Interchangeability:**
  - Configured via environment variable: `AI_PROVIDER=MOCK | FASHN | REPLICATE | IMAGEN`.
  - The business logic invokes `tryOnProviderRegistry.getProvider().generateTryOn(input)` exclusively.
