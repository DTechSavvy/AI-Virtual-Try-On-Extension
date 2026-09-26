# Security & Privacy Architecture

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Classification:** Core Security Specification  

---

## 1. Threat Model & Privacy Mandate

In direct compliance with Section 14 of the assignment document:
> *"Personal photographs are sensitive user data and must be handled carefully. Do not expose user profile images publicly. Use secure communication between the extension and backend. Do not expose API keys inside the Chrome extension. Clearly identify where profile images are stored. Allow the user to delete their profile and generated results. Do not use personal images for model training unless the user has explicitly provided appropriate permission."*

This document formalizes the defensive controls governing data handling, network transit, credential management, and privacy rights across the entire platform.

---

## 2. Threat Vector Mitigation Matrix

| Threat Vector | Attack Scenario | Mitigation Control |
|---|---|---|
| **Public Image Snooping** | Attacker guesses sequential URLs to view user profile photos or generated try-on imagery. | Private S3 buckets with default block on all public access. Media access granted exclusively via cryptographic HMAC-SHA256 pre-signed URLs with a 15-minute TTL. |
| **Extension Key Extraction** | Attacker unpacks Chrome Extension `.crx` or inspects DevTools source to steal AI provider keys. | **Zero Credentials in Client:** AI API keys (FASHN, Replicate, Vertex) and AWS/S3 secrets reside solely in backend server environment variables. The extension holds only ephemeral user JWTs. |
| **Malicious File Upload** | Attacker uploads web shells, executable scripts, or polyglot files via photo upload. | Multi-tier file validation: Magic-byte inspection via `file-type`, strict image decoding & sanitization via `Sharp`, max file size capped at 10MB, metadata/EXIF stripping. |
| **Cross-Site Request Forgery (CSRF)** | Malicious third-party website triggers unauthorized try-ons or profile modifications. | The Chrome Extension interacts with the backend via Bearer token authentication in the `Authorization` header. Browsers do not automatically attach Bearer tokens across cross-site origins. |
| **AI Model Leakage / Training** | User photos are harvested by external AI providers to train foundational vision models. | Enterprise zero-data-retention agreements or ephemeral inference parameters (`store: false`, `training_consent: false`) configured on all external provider requests. |
| **Profile Residuals after Deletion** | User deletes account or profile, but images persist indefinitely in object storage. | Transactional cascading deletes: Database delete trigger initiates immediate asynchronous deletion of the entire user folder prefix in S3 (`StorageService.deleteFolder()`). |

---

## 3. Storage Architecture & Isolation

```mermaid
graph TD
    subgraph Client ["Client Browser"]
        EXT["Chrome Extension Side Panel"]
    end

    subgraph API ["Backend API Layer"]
        AUTH_G["JWT Tenancy Guard\n(Ensures user can only access own records)"]
        S3_SERV["StorageService\n(AWS SDK / MinIO Client)"]
    end

    subgraph S3 ["Private Object Storage Bucket"]
        subgraph BucketPolicy ["Bucket Policy: BlockPublicAccess = TRUE"]
            P_USER["profiles/{userId}/{profileId}/{photoId}.webp"]
            R_USER["results/{userId}/{jobId}.webp"]
        end
    end

    EXT -->|1. GET /profiles/:id| AUTH_G
    AUTH_G --> S3_SERV
    S3_SERV -->|2. Generate HMAC Presigned GET (TTL: 900s)| S3
    S3_SERV -->> EXT: 3. Return Presigned URL
    EXT -->|4. Direct Secure GET with Short-Lived Signature| S3
```

### Storage Location Identification
- In compliance with assignment requirements, users are explicitly informed of storage location during onboarding:
  - **Local Development / Self-Hosted:** Encrypted local MinIO private bucket.
  - **Cloud Production:** Region-isolated AWS S3 bucket (e.g., `us-east-1` or `eu-central-1`) with server-side encryption (SSE-S3 or AWS KMS).
  - Storage path structure:
    - User Profiles: `profiles/{userId}/{profileId}/{photoId}.webp`
    - Try-On Results: `results/{userId}/{jobId}.webp`

---

## 4. Authentication & Token Lifecycle

1. **Access Tokens:**
   - Standard: Signed JWT using HMAC-SHA256 (or RS256).
   - Payload: `{ sub: userId, email: userEmail, role: 'USER' }`.
   - Lifespan: 15 minutes (900 seconds).
   - Storage in Extension: Stored in `chrome.storage.session`, which is automatically wiped when Chrome closes.
2. **Refresh Tokens:**
   - Cryptographically random 256-bit string hashed with SHA-256 before storage in PostgreSQL.
   - Lifespan: 7 days.
   - Rotated upon every refresh call; old refresh tokens are immediately invalidated.
3. **Password Security:**
   - Passwords hashed using `bcrypt` (work factor 12) or `argon2id`.

---

## 5. Privacy & User Rights (GDPR / CCPA)

- **Right to Access:** User can retrieve all stored profile photos and try-on history via `/profiles` and `/try-on/results`.
- **Right to Erasure (Purge):**
  - Executed via `DELETE /user/data`.
  - Drops user record, cascade deletes all database foreign keys, and purges all media files in S3.
- **Model Training Opt-In:**
  - Database stores `consent_training: BOOLEAN DEFAULT FALSE`.
  - Default is strictly opt-out. AI payloads instruct providers that data is confidential and transient.
