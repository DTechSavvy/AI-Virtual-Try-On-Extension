# Requirements Specification — AI Virtual Try-On Chrome Extension

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Authoritative Source:** `AI_Virtual_Try_On_Chrome_Extension_Assignment.pdf`  
**Classification:** Core Engineering Specification  

---

## 1. Executive Summary & Objective

The objective of this project is to build a production-grade Chrome extension and supporting backend platform that empowers online shoppers to create a reusable **Personal Digital Profile** and virtually try on products found across diverse, arbitrary e-commerce websites.

The system must overcome the limitations of single-store virtual try-on plugins by operating as an autonomous, cross-website AI shopping assistant. It identifies apparel and accessory products directly within the active browser tab, normalizes their metadata and imagery, maps them to the appropriate body regions of the user's digital profile, and executes a photorealistic virtual try-on generation via an asynchronous AI pipeline.

---

## 2. Assignment Traceability Matrix

Every requirement in this specification maps directly to the official examination assignment document (`AI_Virtual_Try_On_Chrome_Extension_Assignment.pdf`). Where engineering design decisions are made to implement a requirement, they are explicitly tagged as `[Implementation Decision]`.

| PDF Section | Section Title | Specification Coverage in this Document | Requirement Tag |
|---|---|---|---|
| **Section 1** | Objective | Section 1, Section 3.1 | `REQ-OBJ-01` |
| **Section 2** | Core Concept & Workflow | Section 4 (Core Workflow Steps 1–9) | `REQ-WF-01` to `REQ-WF-09` |
| **Section 3** | Personal Digital Profile | Section 5 (Profile & Supported Photos) | `REQ-PROF-01` to `REQ-PROF-07` |
| **Section 4** | Product Categories | Section 6 (Supported Categories & Extensibility) | `REQ-CAT-01` to `REQ-CAT-04` |
| **Section 5** | Chrome Extension | Section 7 (Extension UI, Side Panel, V3) | `REQ-EXT-01` to `REQ-EXT-08` |
| **Section 6** | Product Detection | Section 8 (Generic Detection & Extraction) | `REQ-DET-01` to `REQ-DET-10` |
| **Section 7** | AI Virtual Try-On | Section 9 (AI Pipeline, Regional Positioning) | `REQ-AI-01` to `REQ-AI-07` |
| **Section 8** | Context-Aware Visualization | Section 9.2 (Context & Environment Blending) | `REQ-AI-08` to `REQ-AI-10` |
| **Section 9** | Product Accuracy | Section 9.3 (Fidelity, Color, Pattern, Proportions) | `REQ-ACC-01` to `REQ-ACC-06` |
| **Section 10** | Multiple Product Images | Section 8.4 (Image Selection & Variant Handling) | `REQ-IMG-01` to `REQ-IMG-05` |
| **Section 11** | User Experience | Section 10 (Shopper Journey & Frictionless UX) | `REQ-UX-01` to `REQ-UX-06` |
| **Section 12** | Supported Website Testing | Section 11 (Cross-Site Validation) | `REQ-TEST-01` to `REQ-TEST-04` |
| **Section 13** | Backend & AI Architecture | Section 12 (Service Architecture & Storage) | `REQ-BE-01` to `REQ-BE-08` |
| **Section 14** | Privacy & Security | Section 13 (Data Isolation, Deletion, No Key Leakage) | `REQ-SEC-01` to `REQ-SEC-08` |
| **Section 15** | Performance | Section 14 (Caching, Async Jobs, Optimization) | `REQ-PERF-01` to `REQ-PERF-07` |
| **Section 16** | Mandatory Demonstration | Section 15 (Demonstration Protocol) | `REQ-DEMO-01` to `REQ-DEMO-08` |
| **Section 17** | Required Deliverables | Section 16 (Source, Build, Video, Documentation) | `REQ-DELIV-01` to `REQ-DELIV-08` |
| **Section 18** | Bonus Challenges | Section 17 (Advanced Features) | `REQ-BONUS-01` to `REQ-BONUS-12` |
| **Section 19** | Important Constraints | Section 18 (Legal, Non-Bypass, Technical Focus) | `REQ-CONST-01` to `REQ-CONST-04` |
| **Section 20** | Expected Outcome | Section 19 (End-State System Reality) | `REQ-OUT-01` |

---

## 3. Functional Requirements

### 3.1 Digital Profile Management (`REQ-PROF`)
- **REQ-PROF-01 (Authoritative - PDF §3):** The system shall allow users to create and maintain a reusable digital profile that persists across multiple shopping sessions and try-on requests without requiring repeated image uploads.
- **REQ-PROF-02 (Authoritative - PDF §3):** The profile shall support multiple specific photograph types:
  - Front / full-body photograph
  - Upper-body photograph
  - Leg / lower-body photograph
  - Foot / shoe photograph
  - Face / neck photograph
  - Additional photographs required by specific AI models.
- **REQ-PROF-03 (Authoritative - PDF §3):** The system must provide structured, visual guidance to the user during photograph capture/upload detailing optimal framing, lighting, neutral poses, solid/contrasting background, proper camera distance, and apparel guidelines (e.g., form-fitting clothing).
- **REQ-PROF-04 (Authoritative - PDF §3):** The system shall maintain an intelligent category-to-photo routing matrix that automatically selects the appropriate reference photograph for each try-on category (e.g., upper-body/full-body for tops; full-body for dresses; lower-body/full-body for trousers; feet for shoes; face/neck for jewellery).
- **REQ-PROF-05 [Implementation Decision]:** The user shall be able to preview, update, replace, or delete individual photographs within their profile at any time.
- **REQ-PROF-06 [Implementation Decision]:** Client-side image pre-validation shall verify minimum resolution (e.g. 512x512px), file size (under 10MB), and supported MIME types (`image/jpeg`, `image/png`, `image/webp`).
- **REQ-PROF-07 (Authoritative - PDF §14):** Complete profile deletion must be supported, instantly unlinking and permanently purging all user photographs from the private storage system.

### 3.2 Product Detection & Extraction (`REQ-DET`)
- **REQ-DET-01 (Authoritative - PDF §5, §6):** The Chrome extension shall investigate the currently active webpage and detect product information without requiring the user to manually save, download, or re-upload product images.
- **REQ-DET-02 (Authoritative - PDF §6):** The detection engine must be generic and function across heterogeneous e-commerce platforms (e.g., Shopify stores, Amazon, Myntra, Zara, ASOS, generic boutique storefronts) rather than relying on site-specific hardcoded selectors.
- **REQ-DET-03 (Authoritative - PDF §6):** The detector shall harvest and cross-reference multiple DOM and metadata sources:
  - JSON-LD structured data (`schema.org/Product`)
  - Microdata and RDFa markup
  - OpenGraph tags (`og:title`, `og:image`, `product:price:amount`, etc.)
  - Standard HTML image tags (`<img>`, `<picture>`, `srcset`, `data-src`, lazy-loaded attributes)
  - DOM text heuristics (headings `<h1>`-`<h3>`, price regex matches, cart buttons, product cards).
- **REQ-DET-04 (Authoritative - PDF §5, §6):** The detection engine must handle both:
  1. Individual product detail pages (PDP) containing high-resolution hero imagery, variant galleries, and detailed descriptions.
  2. Product listing/catalog pages (PLP) containing multiple distinct product cards.
- **REQ-DET-05 (Authoritative - PDF §10):** When a product possesses multiple imagery angles or variants (e.g., front, back, model view, flat lay), the detector must harvest all candidates, rank them for try-on viability, and allow the user to select their preferred image or variant before generating.
- **REQ-DET-06 (Authoritative - PDF §6):** The system shall calculate a confidence score for each detected product and filter out non-product imagery (e.g., logos, banners, tracking pixels, navigation icons).
- **REQ-DET-07 [Implementation Decision]:** Extensibility hooks (website adapters) shall be supported to allow enhanced extraction on complex single-page applications without polluting the core generic heuristic engine.

### 3.3 Product Categorization & Normalization (`REQ-CAT`)
- **REQ-CAT-01 (Authoritative - PDF §4):** The system shall natively classify and support at minimum the following product types:
  - T-shirts and tops
  - Shirts
  - Dresses
  - Jackets and outerwear
  - Pants and trousers
  - Shoes and footwear
  - Jewellery
  - Necklaces
  - Accessories
- **REQ-CAT-02 (Authoritative - PDF §4):** The category architecture must be modular and extensible so that new categories (e.g., eyewear, hats, skirts, bags) can be added without modifying the extension UI or database schema.
- **REQ-CAT-03 (Authoritative - PDF §6, §18):** Category determination shall occur automatically using title keywords, breadcrumbs, JSON-LD category attributes, and image classification heuristics, while allowing user override in the UI if misclassified.
- **REQ-CAT-04 [Implementation Decision]:** Products must be normalized into an immutable server-side entity containing normalized title, category enum, currency, price, brand, source URL, domain, primary image, and variant image list.

### 3.4 AI Virtual Try-On Execution (`REQ-AI`)
- **REQ-AI-01 (Authoritative - PDF §7):** The AI generation pipeline shall composite the selected product onto the user's digital profile photograph, placing the product naturally on the anatomically appropriate body region with correct perspective and proportions.
- **REQ-AI-02 (Authoritative - PDF §7):** The virtual try-on must preserve the user's identifiable physical characteristics: facial features, hair, body shape, skin tone, and natural posture.
- **REQ-AI-03 (Authoritative - PDF §9):** The virtual try-on must strictly preserve product visual fidelity:
  - Color hues and saturation
  - Fabric patterns, textures, and prints
  - Graphics, emblems, and logos
  - Garment silhouette, sleeve length, collar cut, and natural drape.
- **REQ-AI-04 (Authoritative - PDF §8):** The system shall avoid crude 2D sticker pasting. Where context-aware visualization is active, the AI shall blend the garment realistically with lighting, subtle shadows, natural creasing, and appropriate environmental context.
- **REQ-AI-05 (Authoritative - PDF §13):** The backend must abstract the AI model via a pluggable provider interface (`TryOnProvider`), enabling seamless switching between commercial APIs (e.g., FASHN.ai, Kling, Replicate IDM-VTON) or self-hosted diffusion pipelines without client code changes.
- **REQ-AI-06 [Implementation Decision]:** AI request payloads must include the masked profile image, product garment image, garment category, target pose/body cues, and negative prompts preventing body distortion.
- **REQ-AI-07 [Implementation Decision]:** Output validation shall inspect generated images for corrupt data, invalid dimensions, or generation artifacts before saving and returning the result to the client.

### 3.5 Asynchronous Job Processing (`REQ-JOB`)
- **REQ-JOB-01 (Authoritative - PDF §5, §15):** Virtual try-on generation must operate as an asynchronous background job process. Client requests shall immediately receive a unique `jobId` rather than keeping an HTTP connection open indefinitely.
- **REQ-JOB-02 (Authoritative - PDF §5):** The system shall transition jobs through explicit lifecycle states: `CREATED` $\rightarrow$ `QUEUED` $\rightarrow$ `PROCESSING` $\rightarrow$ `COMPLETED` / `FAILED` / `CANCELLED`.
- **REQ-JOB-03 (Authoritative - PDF §5, §15):** The Chrome extension shall monitor job progress (via polling or event streams), displaying intermediate progress status (e.g., "Queued", "Analyzing Garment", "Generating Fit", "Finalizing Rendering") to the user.
- **REQ-JOB-04 (Authoritative - PDF §15):** Robust error handling must catch AI timeouts, rate limits, or provider outages, providing actionable user feedback and safe retries without duplicate billing or orphaned jobs.

### 3.6 Wardrobe, History & Result Visualization (`REQ-RES`)
- **REQ-RES-01 (Authoritative - PDF §2, §5):** Upon job completion, the extension side panel shall display the generated photorealistic try-on result with high-resolution zooming and full-screen preview.
- **REQ-RES-02 (Authoritative - PDF §18):** The system shall store previously generated try-on results in a virtual wardrobe / history log, allowing shoppers to review previous outfits, compare different items side-by-side, and download visualizations.
- **REQ-RES-03 (Authoritative - PDF §14):** Users must be able to delete individual try-on results or their entire wardrobe history at any time.

---

## 4. Non-Functional Requirements

### 4.1 Usability & Accessibility (`NFR-USE`)
- **NFR-USE-01 (Authoritative - PDF §11):** The user experience must be intuitive for everyday, non-technical shoppers, requiring minimal interaction (Select Product $\rightarrow$ Click 'Try On' $\rightarrow$ View Result).
- **NFR-USE-02 (Authoritative - PDF §5):** The primary user interface shall reside in the modern Chrome Side Panel API, enabling persistent visibility while the user scrolls or navigates across tabs and shopping pages.
- **NFR-USE-03 [Implementation Decision]:** The interface shall comply with WCAG 2.1 AA accessibility guidelines, offering high color contrast, keyboard navigability, clear focus states, and ARIA labels.

### 4.2 Security & Privacy (`NFR-SEC`)
- **NFR-SEC-01 (Authoritative - PDF §14):** Personal photographs and generated outputs are classified as sensitive personal data and must never be exposed publicly.
- **NFR-SEC-02 (Authoritative - PDF §14):** Cloud object storage (S3 / MinIO) must enforce private ACLs. Images shall only be accessible through short-lived, pre-signed URLs (TTL $\le 15$ minutes) or authenticated proxy endpoints.
- **NFR-SEC-03 (Authoritative - PDF §14):** Under no circumstances shall third-party AI provider API keys or cloud storage credentials be packaged, bundled, or exposed inside the Chrome extension client code.
- **NFR-SEC-04 (Authoritative - PDF §14):** All communication between the Chrome extension and the backend service must occur over TLS 1.3 / HTTPS.
- **NFR-SEC-05 (Authoritative - PDF §14):** User photographs shall strictly be utilized for real-time try-on inference and must never be used to train or fine-tune public models without explicit user consent.
- **NFR-SEC-06 (Authoritative - PDF §14):** The system must implement complete data deletion mechanisms (GDPR Right to Erasure), removing all database records and storage blobs upon account or profile deletion.

### 4.3 Performance & Scalability (`NFR-PERF`)
- **NFR-PERF-01 (Authoritative - PDF §15):** The client extension shall never repeatedly upload profile photos for subsequent try-ons; profile images are uploaded once, validated, stored server-side, and referenced by ID.
- **NFR-PERF-02 (Authoritative - PDF §15):** Product detection on an active tab must complete candidate extraction and scoring within 400 milliseconds to prevent page lag.
- **NFR-PERF-03 (Authoritative - PDF §15):** Image payloads transferred between extension, backend, and AI providers must be pre-optimized (WebP/JPEG conversion, target resolution clamping e.g. 1024x1024) to reduce transmission time and token usage.
- **NFR-PERF-04 (Authoritative - PDF §15):** The backend job queue must scale horizontally, supporting concurrent try-on requests without worker starvation or request timeouts.

### 4.4 Portability & Cross-Website Compatibility (`NFR-COMPAT`)
- **NFR-COMPAT-01 (Authoritative - PDF §6, §12):** The content script must remain non-intrusive, injecting zero global styling conflicts into the host e-commerce page (leveraging Shadow DOM or running exclusively inside the extension side panel).
- **NFR-COMPAT-02 (Authoritative - PDF §19):** The extension shall operate strictly within standard browser permissions, never attempting to bypass site anti-bot protections, CAPTCHAs, or authentication firewalls.

---

## 5. Technical Constraints (`REQ-CONST`)

- **REQ-CONST-01 (Authoritative - PDF §5):** Built exclusively for Google Chrome using **Manifest V3** standards. Service workers must be stateless and handle transient lifecycles gracefully.
- **REQ-CONST-02 (Authoritative - PDF §19):** Interactions must be limited to publicly accessible DOM elements and products the user is legitimately viewing.
- **REQ-CONST-03 (Authoritative - PDF §13, §14):** AI orchestration, credential storage, and database persistence must reside strictly on the server-side backend.
- **REQ-CONST-04 [Implementation Decision]:** Backend written in TypeScript on Node.js runtime, utilizing PostgreSQL as the relational database engine and Redis for background job queuing.

---

## 6. Definition of Done (DoD)

A feature or phase is considered complete only when:
1. **Traceability:** The implementation satisfies all corresponding requirements identified in this document.
2. **Type Safety:** Full TypeScript compilation succeeds with zero linter errors (`strict: true`).
3. **Automated Testing:** Unit tests and integration tests pass covering the core logic, error branches, and edge cases.
4. **Security Verification:** Zero secrets or API keys are bundled in client assets; signed URLs and authorization checks are enforced.
5. **Cross-Site Verification:** Product detection and try-on workflow validated across at least two distinct commercial shopping websites (e.g. Amazon and Zara/Myntra).
6. **Documentation:** Architecture diagrams, API endpoints, and configuration examples are fully updated.
