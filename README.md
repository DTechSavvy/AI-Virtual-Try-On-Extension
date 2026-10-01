# 🛍️ AI Virtual Try-On Chrome Extension

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Manifest-V3-success.svg?logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg?logo=node.js)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![BullMQ](https://img.shields.io/badge/Queue-BullMQ%20%2B%20Redis-red.svg?logo=redis)](https://bullmq.io/)
[![Model](https://img.shields.io/badge/Diffusion-IDM--VTON-purple.svg)](https://github.com/yisol/IDM-VTON)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> An enterprise-grade, privacy-first **Chrome Extension (Manifest V3)** and **Distributed AI Backend** that brings authentic neural virtual try-on directly to any e-commerce shopping website (Myntra, Zara, Amazon, and more). Powered by state-of-the-art **IDM-VTON** diffusion synthesis, a reusable user biometric profile vault, and resilient real-time DOM product extraction.

---

## 📌 Repository Description (for GitHub "About" section)

> *AI-powered Chrome Extension (Manifest V3) for cross-website virtual garment try-on using IDM-VTON neural diffusion, React Side Panel, BullMQ, Redis, PostgreSQL, and private S3 storage.*

**Topics / Tags:**  
`virtual-try-on` • `vton` • `chrome-extension` • `manifest-v3` • `diffusion-models` • `idm-vton` • `react` • `vite` • `typescript` • `bullmq` • `redis` • `prisma` • `ecommerce-ai` • `sidepanel-api`

---

## 🌟 Key Highlights & Features

- **🌐 Universal Real-Time Product Detection**:
  - Automatically identifies apparel items on Product Detail Pages (PDP) and Product Listing Pages (PLP) across any shopping website.
  - Multi-strategy extraction: Schema.org `JSON-LD`, OpenGraph metadata, and visual DOM heuristics.
  - Automatic category classification (`TOPS`, `DRESSES`, `SHIRTS`, `PANTS`, `JACKETS`).
- **🧬 Single-Upload Digital Identity**:
  - Upload your photo once (`FRONT_FULL_BODY`, `UPPER_BODY`, etc.) to your secure biometric vault.
  - Reused seamlessly across thousands of shopping items without repeated uploads.
- **🎨 Neural Diffusion Synthesis (IDM-VTON)**:
  - Replaces rudimentary 2D image-overlap stickers with genuine neural virtual try-on.
  - Models realistic fabric draping, collar alignment, sleeves, texture folds, shadows, and body curvature matching your pose.
- **⚡ Asynchronous Queue & Distributed Worker Architecture**:
  - BullMQ + Redis job orchestration decouples long-running AI inference from client interactions.
  - Real-time job polling, progress tracking, and resilient failure recovery.
- **🗂️ Interactive Side Panel & Virtual Wardrobe**:
  - Built natively with **Chrome Side Panel API** and **React 18 / Vite**.
  - Side-by-side Before/After toggle, high-resolution zoom viewer, and one-click wardrobe lookbook saving/downloading.
- **🛡️ Enterprise Security & Privacy Compliance**:
  - Personal photos stored in private object storage (S3 / MinIO) with short-lived pre-signed URLs.
  - RFC 7807 standardized problem detail error handling, JWT auth tokens, and strict Content Security Policies (CSP).

---

## 🏗️ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    User Shopping Webpage (Any Site)    │
                      └──────────────────┬─────────────────────┘
                                         │ (DOM Scraped via Content Script)
                                         ▼
   ┌───────────────────────────────────────────────────────────────────────────┐
   │                     Chrome Extension (Manifest V3)                        │
   │  ┌────────────────────────┐  ┌─────────────────────────────────────────┐  │
   │  │   DOM Content Script   │  │       React Side Panel UI (Vite)        │  │
   │  │ - JSON-LD / Microdata  │  │ - Product Grid & Inspector              │  │
   │  │ - DOM Heuristic Engine │  │ - Try-On Stepper & Job Progress         │  │
   │  │ - High-Res Extraction  │  │ - Before/After Toggle & Wardrobe View   │  │
   │  └───────────┬────────────┘  └────────────────────▲────────────────────┘  │
   │              │ Extension Messaging                │ Polling & Results     │
   │              └────────────────────────────────────┼───────────────────────┘
   │                                                   │
   └───────────────────────────────────────────────────┼───────────────────────┘
                                                       │ Authenticated REST APIs
                                                       ▼
   ┌───────────────────────────────────────────────────────────────────────────┐
   │                          Backend API Transport                            │
   │  - Express.js / TypeScript Core Server (Port 4000)                        │
   │  - Auth (JWT Access / Refresh, Bcrypt, Biometric Consent)                 │
   │  - Rate Limiting, Input Validation (Zod), RFC 7807 Problem Details        │
   └──────────────────────┬────────────────────────────┬───────────────────────┘
                          │ Push Job                   │ Read/Write
                          ▼                            ▼
   ┌──────────────────────────────┐        ┌───────────────────────────────────┐
   │     BullMQ Redis Queue       │        │  PostgreSQL (Prisma ORM) & MinIO  │
   │  `vton-try-on-jobs`          │        │  - Users, Profiles, Products      │
   └──────────────┬───────────────┘        │  - Encrypted / Private S3 Buckets │
                  │ Dispatches             └───────────────────────────────────┘
                  ▼
   ┌───────────────────────────────────────────────────────────────────────────┐
   │                       Standalone Try-On Worker                            │
   │  - Garment Image Fetching & Normalization (Sharp)                         │
   │  - User Photo Retrieval from Private Storage                              │
   │  - Neural AI Synthesis: IDM-VTON (Diffusion Space API)                    │
   │  - Result Upload & Database State Completion                              │
   └───────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 Monorepo Structure

```
.
├── extension/                 # Manifest V3 Chrome Extension
│   ├── public/manifest.json   # Chrome MV3 manifest definition (Side Panel enabled)
│   ├── src/
│   │   ├── background/        # Background Service Worker
│   │   ├── content/           # DOM Product Extractor (JSON-LD + Heuristics)
│   │   └── sidepanel/         # React Side Panel UI application
│   └── vite.config.ts         # Multi-target Vite bundler
│
├── backend/                   # Node.js / Express TypeScript Server & Worker
│   ├── src/
│   │   ├── config/            # Environment & Redis connection config
│   │   ├── modules/           # Auth, Profile, Product, Try-On domains
│   │   │   └── try-on/
│   │   │       ├── providers/ # AI Providers (IDM-VTON, Mock, HuggingFace)
│   │   │       └── queue/     # BullMQ Job Queue & Standalone Worker
│   │   ├── services/          # S3 / MinIO Private Storage Service
│   │   ├── main.ts            # REST API entry point
│   │   └── worker.ts          # Distributed BullMQ Worker process
│   └── prisma/schema.prisma   # PostgreSQL Relational Database Schema
│
├── shared/                    # Shared Types, DTOs & Contracts (`@vton/shared`)
│   └── src/types/             # NormalizedProduct, TryOnJob, Auth, Categories
│
├── infrastructure/            # Local Development Stack
│   └── docker-compose.yml     # PostgreSQL, Redis, and MinIO container spec
│
└── docs/                      # Architectural specifications & requirements
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
|---|---|
| **Chrome Extension** | Manifest V3, React 18, TypeScript, Vite, Side Panel API, Chrome Scripting |
| **Backend & Worker** | Node.js (v20+), Express.js, TypeScript, BullMQ, Redis, Prisma ORM, Sharp |
| **Database & Storage** | PostgreSQL, S3 / MinIO Private Object Storage |
| **AI Neural Engine** | **IDM-VTON** (Diffusion-based Virtual Try-On), Gradio Client API |
| **Validation & Security**| Zod, RFC 7807 Problem Details, JWT, Bcrypt, Content Security Policy |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** v20.x or higher
- **npm** v10.x or higher
- **Redis** and **PostgreSQL** (via Docker or local WSL service)

### 2. Clone Repository & Install Dependencies
```bash
git clone https://github.com/DTechSavvy/AI-Virtual-Try-On-Extension.git
cd AI-Virtual-Try-On-Extension

# Install all workspace dependencies
npm install
```

### 3. Configure Environment Variables
Copy the `.env.example` in both root and `backend/`:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Configure your `backend/.env` with your database and AI provider settings:
```ini
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vton_db?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

# AI Provider Configuration (IDM-VTON Neural Diffusion)
AI_PROVIDER=IDM_VTON
HF_API_TOKEN=your_optional_huggingface_token
```

### 4. Database Setup
```bash
cd backend
npx prisma migrate dev
npx prisma generate
cd ..
```

### 5. Build Workspaces
```bash
# Build shared types, extension, and backend
npm run build
```

### 6. Run Backend & Worker
In Terminal 1 (API Server):
```bash
npm run start --workspace=@vton/backend
```

In Terminal 2 (Try-On Queue Worker):
```bash
npm run worker --workspace=@vton/backend
```

---

## 🧩 Loading the Extension into Google Chrome

1. Open **Google Chrome** and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `extension/dist/` directory from this project.
5. Pin the **AI Virtual Try-On Assistant** to your toolbar.
6. Open any product page (e.g. Myntra, Zara, or our local demo at `http://localhost:8089/`) and click the extension icon to launch the Side Panel.

---

## 🧪 Testing & Verification

Run the full end-to-end unit and integration test suites:
```bash
# Typecheck all packages
npm run typecheck

# Run Backend unit & integration tests
npm run test --workspace=@vton/backend

# Run Extension DOM scanner tests
npm run test --workspace=@vton/extension
```

---

## 🔒 Privacy & Biometric Data Handling

- **Zero Public Access**: Personal user photos are encrypted and stored in strictly private object buckets.
- **Short-Lived URLs**: Media assets are delivered only via time-limited (15-minute) pre-signed URLs.
- **Explicit Consent**: Requires explicit user biometric consent during onboarding.
- **Right to be Forgotten**: Full profile and account deletion purges both database records and physical S3 object storage blobs.

---

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
