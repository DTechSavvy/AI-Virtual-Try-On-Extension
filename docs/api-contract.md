# REST API Contract Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Base URL:** `/api/v1`  
**Authentication Scheme:** Bearer JWT in `Authorization` header  

---

## 1. Authentication & Session Endpoints

### 1.1 `POST /auth/register`
Creates a new shopper account.
- **Request Body:**
  ```json
  {
    "email": "shopper@example.com",
    "password": "StrongPassword123!",
    "displayName": "Alex Morgan",
    "consentTraining": false
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "user": {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "email": "shopper@example.com",
      "displayName": "Alex Morgan",
      "consentTraining": false,
      "createdAt": "2026-09-26T08:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "7c9e6679...",
      "expiresIn": 900
    }
  }
  ```

### 1.2 `POST /auth/login`
Authenticates a user and issues tokens.
- **Request Body:**
  ```json
  {
    "email": "shopper@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200 OK):** Same payload as `/auth/register`.

### 1.3 `POST /auth/refresh`
Rotates and issues a new access token.
- **Request Body:**
  ```json
  {
    "refreshToken": "7c9e6679..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "8d0f7780...",
    "expiresIn": 900
  }
  ```

---

## 2. Digital Profile Endpoints

### 2.1 `GET /profiles`
Retrieves all digital profiles for the authenticated user.
- **Response (200 OK):**
  ```json
  [
    {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Default Profile",
      "isDefault": true,
      "images": [
        {
          "id": "img-001",
          "photoType": "FRONT_FULL_BODY",
          "presignedUrl": "https://s3.local/bucket/profiles/...?X-Amz-Signature=...",
          "width": 1024,
          "height": 1365,
          "createdAt": "2026-09-26T08:05:00Z"
        }
      ]
    }
  ]
  ```

### 2.2 `POST /profiles/:id/images`
Uploads a new photograph to a digital profile.
- **Content-Type:** `multipart/form-data`
- **Fields:**
  - `photoType`: `FRONT_FULL_BODY` | `UPPER_BODY` | `LOWER_BODY` | `FEET` | `FACE`
  - `file`: Image binary (`image/jpeg`, `image/png`, `image/webp`, max 10MB)
- **Response (201 Created):**
  ```json
  {
    "id": "img-002",
    "profileId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "photoType": "UPPER_BODY",
    "presignedUrl": "https://s3.local/bucket/profiles/...",
    "width": 768,
    "height": 1024,
    "fileSizeBytes": 451200
  }
  ```

### 2.3 `DELETE /profiles/:id`
Permanently deletes a digital profile and its stored photographs.
- **Response (204 No Content)**

---

## 3. Product Normalization Endpoints

### 3.1 `POST /products/normalize`
Validates, deduplicates, and normalizes candidate products detected on a shopping page.
- **Request Body:**
  ```json
  {
    "sourceDomain": "zara.com",
    "sourceUrl": "https://www.zara.com/us/en/linen-blend-shirt-p03057400.html",
    "title": "Linen Blend Oversized Shirt",
    "category": "SHIRTS",
    "brand": "Zara",
    "price": 49.90,
    "currency": "USD",
    "images": [
      {
        "url": "https://static.zara.net/photos/.../w/1024/front.jpg",
        "isPrimary": true,
        "score": 0.95
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "productId": "prod-998877",
    "category": "SHIRTS",
    "targetBodyRegion": "UPPER_BODY",
    "recommendedPhotoType": "UPPER_BODY",
    "sanitizedProduct": { ... }
  }
  ```

---

## 4. Virtual Try-On Job Endpoints

### 4.1 `POST /try-on/jobs`
Initiates an asynchronous virtual try-on job.
- **Request Body:**
  ```json
  {
    "profileId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "productId": "prod-998877",
    "selectedImageUrl": "https://static.zara.net/photos/.../front.jpg",
    "category": "SHIRTS",
    "generationMode": "STANDARD",
    "contextEnvironment": "studio neutral"
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "jobId": "job-554433",
    "status": "QUEUED",
    "estimatedLatencySeconds": 10,
    "statusUrl": "/api/v1/try-on/jobs/job-554433",
    "createdAt": "2026-09-26T08:10:00Z"
  }
  ```

### 4.2 `GET /try-on/jobs/:id`
Polls the execution status of an active try-on job.
- **Response (200 OK - Processing):**
  ```json
  {
    "jobId": "job-554433",
    "status": "PROCESSING",
    "progressPercent": 65,
    "currentStage": "AI Garment Inpainting",
    "updatedAt": "2026-09-26T08:10:06Z"
  }
  ```
- **Response (200 OK - Completed):**
  ```json
  {
    "jobId": "job-554433",
    "status": "COMPLETED",
    "progressPercent": 100,
    "result": {
      "id": "res-112233",
      "imageUrl": "https://s3.local/bucket/results/...?X-Amz-Signature=...",
      "width": 1024,
      "height": 1024,
      "latencyMs": 8420,
      "completedAt": "2026-09-26T08:10:09Z"
    }
  }
  ```
- **Response (200 OK - Failed):**
  ```json
  {
    "jobId": "job-554433",
    "status": "FAILED",
    "errorCode": "GARMENT_IMAGE_UNREACHABLE",
    "errorMessage": "Unable to fetch high-resolution product image from the source website. Please select an alternate image or variant.",
    "canRetry": true
  }
  ```

---

## 5. Results, Wardrobe & Privacy Endpoints

### 5.1 `GET /try-on/results`
Returns paginated history of all try-on generations for the user.
- **Query Params:** `page=1&limit=20`
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "res-112233",
        "productTitle": "Linen Blend Oversized Shirt",
        "category": "SHIRTS",
        "resultImageUrl": "https://s3.local/bucket/results/...",
        "sourceUrl": "https://www.zara.com/...",
        "createdAt": "2026-09-26T08:10:09Z"
      }
    ],
    "total": 1,
    "page": 1,
    "totalPages": 1
  }
  ```

### 5.2 `DELETE /try-on/results/:id`
Deletes a specific generated try-on result and its object storage artifact.
- **Response (204 No Content)**

### 5.3 `DELETE /user/data`
**GDPR Right to Erasure / Privacy Mandate (Assignment §14):**
Permanently and irrevocably purges the user's account, profile photos, try-on history, and storage objects.
- **Response (204 No Content)**

---

## 6. System Health Endpoint

### 6.1 `GET /health`
Returns health check status of backend dependencies.
- **Response (200 OK):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-26T08:15:00Z",
    "services": {
      "database": "up",
      "redis": "up",
      "storage": "up",
      "aiProvider": "up"
    }
  }
  ```
