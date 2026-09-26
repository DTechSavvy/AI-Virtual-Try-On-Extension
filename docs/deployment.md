# Deployment & Infrastructure Architecture

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** DevOps & Infrastructure Specification  

---

## 1. Overview & Deployment Topologies

The system is designed for dual deployment modes:
1. **Local Self-Contained Development Topology:** A complete local environment orchestrated via Docker Compose, including PostgreSQL, Redis, MinIO (mocking S3), and the Node.js backend.
2. **Cloud Production Topology:** A hardened, highly available cloud deployment utilizing managed relational database services, managed Redis, and scalable container instances.

---

## 2. Local Docker Compose Infrastructure

```mermaid
graph TB
    subgraph DockerHost ["Local Docker Compose Network (vton-net)"]
        BE["backend service\n(Node.js:22 / Express / BullMQ)"]
        PG["postgres service\n(PostgreSQL 16)"]
        REDIS["redis service\n(Redis 7 Alpine)"]
        MINIO["minio service\n(MinIO S3-Compatible Server)"]
        MINIO_INIT["minio-init service\n(Creates 'vton-private' bucket & policies)"]
    end

    subgraph HostBrowser ["Host Machine / Developer"]
        EXT["Chrome Extension\n(Loaded unpacked into Chrome)"]
        DEV["Vite Dev Server\n(Port 5173 / Extension Side Panel)"]
    end

    BE -->|Port 5432| PG
    BE -->|Port 6379| REDIS
    BE -->|Port 9000| MINIO
    MINIO_INIT --> MINIO
    
    EXT -->|HTTP API http://localhost:4000| BE
    EXT -.->|Pre-signed Media URLs http://localhost:9000| MINIO
```

---

## 3. Production Cloud Deployment Topology

```mermaid
graph TB
    subgraph Internet ["Public Internet"]
        CHROME["Shopper Chrome Browser\n(Virtual Try-On Extension)"]
        LB["Cloud Load Balancer / Reverse Proxy (ALB / Cloudflare)\n(TLS 1.3 Termination, WAF, Rate Limiting)"]
    end

    subgraph VPC ["Isolated Cloud VPC"]
        subgraph ComputeCluster ["Containerized Backend (ECS Fargate / Cloud Run)"]
            API_1["Backend API Node 1"]
            API_2["Backend API Node 2"]
            WORKER_1["BullMQ AI Worker 1"]
            WORKER_2["BullMQ AI Worker 2"]
        end

        subgraph ManagedData ["Managed Cloud Data Services"]
            RDS[(Amazon RDS PostgreSQL / Cloud SQL)]
            ELASTI[(Amazon ElastiCache Redis / Memorystore)]
            S3_PROD[(Private Amazon S3 Bucket\nSSE-KMS Encryption)]
        end
    end

    subgraph ExternalSaaS ["External AI Cloud"]
        AI_SAAS["AI Inference Engine\n(FASHN.ai / Replicate / Vertex AI)"]
    end

    CHROME -->|HTTPS REST| LB
    LB --> API_1
    LB --> API_2
    
    API_1 --> RDS
    API_2 --> RDS
    API_1 --> ELASTI
    API_2 --> ELASTI
    
    WORKER_1 <--> ELASTI
    WORKER_2 <--> ELASTI
    WORKER_1 --> RDS
    WORKER_2 --> RDS
    WORKER_1 --> S3_PROD
    WORKER_2 --> S3_PROD
    
    WORKER_1 -->|Private TLS Outbound| AI_SAAS
    WORKER_2 -->|Private TLS Outbound| AI_SAAS
    
    CHROME -.->|Pre-signed HTTPS GET| S3_PROD
```

---

## 4. Chrome Extension Build & Packaging

The Chrome extension is compiled via Vite:
1. **Build Step:**
   ```bash
   npm run build:extension
   ```
2. **Output Artifact:**
   Compiled files are placed in `/packages/extension/dist/`:
   - `manifest.json` (Valid MV3 schema)
   - `service-worker.js` (Root background worker)
   - `content-script.js` (DOM inspection script)
   - `sidepanel.html` & bundled JS/CSS assets
   - High-resolution icons (`icon-16.png`, `icon-48.png`, `icon-128.png`).
3. **Packaging for Distribution:**
   - Script `npm run zip:extension` compresses `/dist` into `ai-virtual-try-on-extension.zip` ready for Chrome Web Store upload or manual unpacked installation via `chrome://extensions`.

---

## 5. Continuous Integration (CI) Workflow

A GitHub Actions pipeline (`.github/workflows/ci.yml`) executes on every commit and pull request:
1. **Typecheck:** `npm run typecheck` across all monorepo packages (`shared`, `backend`, `extension`).
2. **Linting & Formatting:** ESLint and Prettier verification.
3. **Unit Tests:** Jest / Vitest unit tests verifying product detection heuristics, normalization logic, and category mapping.
4. **Integration Tests:** Dockerized PostgreSQL and Redis spin up in CI to test API endpoints and BullMQ job worker flow with `MockTryOnProvider`.
5. **Extension Build Validation:** Manifest schema linting and bundle size budget checks.
