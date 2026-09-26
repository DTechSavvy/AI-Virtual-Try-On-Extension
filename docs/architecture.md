# System Architecture — AI Virtual Try-On Platform

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** Core Engineering Specification  

---

## 1. High-Level Architecture Overview

The AI Virtual Try-On system is an end-to-end shopping assistant platform designed for high modularity, scalability, and strict data privacy. It operates across three distinct tiers:

1. **Client Tier (Chrome Extension — Manifest V3):** Embedded directly into the user's browser, responsible for non-intrusive DOM inspection, generic e-commerce product extraction, user interaction via the Chrome Side Panel, profile capture guidance, and real-time status reporting.
2. **Application Tier (Backend API & Job Orchestrator):** A modular TypeScript Node.js service providing authenticated REST endpoints, product normalization, image optimization, asynchronous background job queuing via Redis/BullMQ, and AI virtual try-on provider dispatch.
3. **Data Tier (Relational DB & Object Storage):** PostgreSQL for structured relational data (users, profiles, products, try-on jobs, results, history) and private S3-compatible Object Storage (MinIO locally / AWS S3 in production) for sensitive profile photos and generated try-on imagery accessed strictly via pre-signed, time-limited URLs.

---

## 2. System Architecture Diagram

```mermaid
graph TB
    subgraph Client ["Client Tier — Chrome Extension (Manifest V3)"]
        CS["Content Script\n(DOM Inspector, JSON-LD, Heuristics)"]
        SW["Background Service Worker\n(Message Router, Auth Session, API Proxy)"]
        SP["Side Panel UI (React + Tailwind/CSS)\n(Profile, Product Select, Try-On, Results)"]
        ST["Extension Storage\n(chrome.storage.local/session)"]
        
        CS <-->|Chrome Tabs Messaging| SW
        SW <-->|Runtime Messaging| SP
        SW <-->|Persist Session/State| ST
    end

    subgraph Gateway ["Edge & Security"]
        HTTPS["TLS 1.3 / HTTPS Gateway & Reverse Proxy"]
        RL["Rate Limiting & CORS Guard"]
    end

    subgraph Backend ["Application Tier — Modular Backend"]
        API["REST API Router & Controllers"]
        AUTH["Auth & Session Module\n(JWT, Refresh Tokens, Scopes)"]
        PROF["Digital Profile Service\n(Guidance, Categorized Photos, Validation)"]
        NORM["Product Normalization Service\n(Candidate Scoring, Deduplication, Category Mapping)"]
        JOBM["Try-On Job Manager\n(Job Lifecycle, Retries, Cancellation)"]
        WORKER["Background Job Worker\n(BullMQ Queue Consumer)"]
        AIPROV["AI Provider Abstraction Layer\n(TryOnProvider Interface)"]
        
        API --> AUTH
        API --> PROF
        API --> NORM
        API --> JOBM
        JOBM -->|Enqueue Job| WORKER
        WORKER --> AIPROV
    end

    subgraph ExternalAI ["External AI Generation Engines"]
        FASHN["FASHN.ai VTON Provider"]
        REPLICATE["Replicate IDM-VTON Provider"]
        IMAGEN["Vertex AI / Imagen Provider"]
        MOCK["Mock Test Provider (CI/Local)"]
        
        AIPROV -.->|HTTPS API| FASHN
        AIPROV -.->|HTTPS API| REPLICATE
        AIPROV -.->|HTTPS API| IMAGEN
        AIPROV -.->|Internal| MOCK
    end

    subgraph Data ["Data & Storage Tier"]
        DB[(PostgreSQL Relational DB\nUsers, Profiles, Products, Jobs, Results)]
        REDIS[(Redis Cache & BullMQ Queue)]
        S3[(Private S3 / MinIO Object Storage\nEncrypted Profile & Generated Assets)]
        
        API --> DB
        WORKER --> DB
        JOBM <--> REDIS
        WORKER <--> REDIS
        API --> S3
        WORKER --> S3
    end

    SP -->|HTTPS API Requests| HTTPS
    SW -->|HTTPS API Requests| HTTPS
    HTTPS --> RL
    RL --> API
    SP -.->|Pre-signed Short-lived URL| S3
```

---

## 3. End-to-End User & Data Workflow

The system strictly executes the 9-step core workflow defined in Section 2 of the assignment:

```mermaid
sequenceDiagram
    autonumber
    actor User as Online Shopper
    participant Web as Shopping Website (e.g. Amazon, Zara)
    participant CS as Content Script
    participant SP as Extension Side Panel
    participant SW as Service Worker
    participant BE as Backend API
    participant Queue as Redis / BullMQ
    participant Worker as Background Worker
    participant AI as AI Try-On Provider
    participant S3 as Private Storage

    Note over User, SP: Step 1: Create Personal Digital Profile
    User->>SP: Upload profile photos (Full-body, Upper-body, etc.)
    SP->>BE: POST /profiles/:id/images (multipart)
    BE->>S3: Store private image & generate record
    BE-->>SP: Profile ready & categorized

    Note over User, Web: Step 2 & 3: Browse Store & Open Extension
    User->>Web: Navigate to product detail or listing page
    User->>SP: Click extension icon / open side panel

    Note over CS, SP: Step 4: Extension Identifies Available Products
    SP->>SW: Request product detection on active tab
    SW->>CS: Execute candidate extraction
    CS->>CS: Harvest JSON-LD, OpenGraph, DOM images & prices
    CS->>CS: Score candidates, filter out non-products, deduplicate
    CS-->>SW: Candidate product list
    SW-->>SP: Render detected products in Side Panel

    Note over User, SP: Step 5 & 6: Select Product & Click 'Try On'
    User->>SP: Select product card & preferred image/variant
    User->>SP: Click "Try On" (Select generation mode)

    Note over SP, Worker: Step 7: Send Appropriate Info to AI Try-On System
    SP->>BE: POST /try-on/jobs (profileId, productData, category, mode)
    BE->>BE: Map category to optimal profile photo (e.g. Tops -> Upper Body)
    BE->>Queue: Enqueue TryOnJob
    BE-->>SP: Return 202 Accepted { jobId, status: "QUEUED" }

    Note over Worker, AI: Step 8: System Generates Realistic Visualization
    Worker->>Queue: Dequeue TryOnJob
    Worker->>S3: Retrieve profile image & download/optimize product image
    Worker->>AI: generateTryOn(profileImg, productImg, category, context)
    AI-->>Worker: Return synthesized virtual try-on image
    Worker->>Worker: Validate output fidelity & dimensions
    Worker->>S3: Store generated visualization (private)
    Worker->>BE: Update Job status to COMPLETED & save TryOnResult

    Note over SP, User: Step 9: Result Displayed & Reused
    loop Poll / Stream Status
        SP->>BE: GET /try-on/jobs/:jobId
        BE-->>SP: Status: PROCESSING / COMPLETED
    end
    BE-->>SP: Return Result with pre-signed view URL
    SP->>User: Display realistic try-on visualization
    Note over User, SP: Profile remains saved for immediate next try-on!
```

---

## 4. Architectural Principles & Invariants

1. **Non-Intrusive Browser Integration:** The extension content script runs with passive listeners and non-destructive DOM queries. It never injects noisy DOM banners or overrides website CSS styles, reserving all rich UI interactions for the Chrome Side Panel.
2. **Asynchronous Decoupling:** AI image generation takes between 3 to 25 seconds depending on model complexity. HTTP endpoints never block on model completion; they enqueue work into BullMQ and return a trackable `jobId` immediately.
3. **Pluggable AI Abstraction:** All AI interactions flow through a unified `TryOnProvider` TypeScript interface. The application logic is completely decoupled from any single vendor's API schema.
4. **Least-Privilege Media Security:** Personal user photographs and generated results are stored in private object storage buckets. Access is granted solely through cryptographic pre-signed URLs with an expiry TTL of 15 minutes.
5. **Zero Credential Exposure:** Neither cloud storage credentials nor AI API keys are compiled into or transmitted to the Chrome extension. All secrets reside exclusively in backend environment variables.
6. **Graceful Degradation:** If an external AI provider experiences latency or outages, the job orchestrator implements exponential backoff retries and delivers explicit, non-cryptic status messages to the user interface.
