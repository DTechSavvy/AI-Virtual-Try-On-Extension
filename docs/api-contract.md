# REST API Contract Specification

**Document Version:** 1.0.0  
**Status:** Approved Architecture Baseline  
**Base URL:** `/api/v1`  
**Authentication Scheme:** Bearer JWT in `Authorization` header  

---

## 1. Authentication & Session Endpoints

### 1.1 `POST /auth/register`
Creates a new shopper account and automatically initializes a default digital profile.
- **Authentication:** Public (Rate Limited: 20 req/min)
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
    "success": true,
    "data": {
      "user": {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "email": "shopper@example.com",
        "displayName": "Alex Morgan",
        "role": "USER",
        "consentTraining": false,
        "createdAt": "2026-09-26T08:00:00.000Z"
      },
      "tokens": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "7c9e6679...",
        "expiresIn": 900
      }
    }
  }
  ```
- **Error Cases:** `400 Validation Error`, `409 EMAIL_ALREADY_EXISTS`.

### 1.2 `POST /auth/login`
Authenticates an existing user and issues fresh tokens.
- **Authentication:** Public (Rate Limited: 20 req/min)
- **Request Body:**
  ```json
  {
    "email": "shopper@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200 OK):** Same payload as `/auth/register`.
- **Error Cases:** `400 Validation Error`, `401 INVALID_CREDENTIALS`.

### 1.3 `POST /auth/refresh`
Rotates the refresh token (revoking the prior token to prevent token reuse attacks) and issues a new access token.
- **Authentication:** Public (Rate Limited: 20 req/min)
- **Request Body:**
  ```json
  {
    "refreshToken": "7c9e6679..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "tokens": {
        "accessToken": "eyJhbGciOi...",
        "refreshToken": "8d0f7780...",
        "expiresIn": 900
      }
    }
  }
  ```
- **Error Cases:** `401 INVALID_REFRESH_TOKEN`.

### 1.4 `POST /auth/logout`
Revokes an active refresh token or all user refresh sessions.
- **Authentication:** Optional (Session token or refresh token)
- **Request Body:**
  ```json
  {
    "refreshToken": "7c9e6679..."
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Successfully logged out."
  }
  ```

### 1.5 `GET /auth/me`
Retrieves summary information for the authenticated user.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "email": "shopper@example.com",
        "displayName": "Alex Morgan",
        "role": "USER",
        "consentTraining": false,
        "createdAt": "2026-09-26T08:00:00.000Z"
      }
    }
  }
  ```
- **Error Cases:** `401 Unauthorized`.

---

## 2. Digital Profile Endpoints

### 2.1 `GET /profile`
Retrieves the user's digital profile, pre-signed URLs for all uploaded photos, and a structured completeness breakdown across all categories.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "profile": {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "name": "Default Profile",
        "isDefault": true,
        "measurements": {
          "heightCm": 178,
          "chestCm": 98,
          "waistCm": 82
        },
        "images": [
          {
            "id": "img-001",
            "profileId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
            "photoType": "UPPER_BODY",
            "presignedUrl": "http://127.0.0.1:9000/vton-private/profiles/...?X-Amz-Signature=...",
            "width": 1024,
            "height": 1365,
            "fileSizeBytes": 451200,
            "createdAt": "2026-09-26T08:05:00.000Z"
          }
        ],
        "completeness": {
          "overallPercentage": 20,
          "availablePhotoTypes": ["UPPER_BODY"],
          "supportedCategories": ["TOPS", "SHIRTS", "JACKETS"],
          "categoryReadiness": {
            "TOPS": {
              "category": "TOPS",
              "displayName": "T-Shirts & Tops",
              "ready": true,
              "activePhotoType": "UPPER_BODY",
              "requiredPhotoType": "UPPER_BODY",
              "fallbackPhotoType": "FRONT_FULL_BODY",
              "missingAssets": [],
              "recommendedAssets": []
            },
            "SHOES": {
              "category": "SHOES",
              "displayName": "Shoes & Footwear",
              "ready": false,
              "activePhotoType": null,
              "requiredPhotoType": "FEET",
              "fallbackPhotoType": "FRONT_FULL_BODY",
              "missingAssets": ["FEET"],
              "recommendedAssets": ["FRONT_FULL_BODY"]
            }
          }
        },
        "createdAt": "2026-09-26T08:00:00.000Z",
        "updatedAt": "2026-09-26T08:05:00.000Z"
      }
    }
  }
  ```

### 2.2 `POST /profile`
Creates an additional digital profile for the user.
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "name": "Formal Profile",
    "isDefault": false,
    "measurements": { "heightCm": 178 }
  }
  ```
- **Response (201 Created):** Profile payload matching `GET /profile`.

### 2.3 `PATCH /profile`
Updates profile metadata and user measurements.
- **Authentication:** Bearer JWT required
- **Request Body:**
  ```json
  {
    "name": "Updated Profile Name",
    "measurements": { "heightCm": 180, "waistCm": 84 }
  }
  ```
- **Response (200 OK):** Updated profile payload.

### 2.4 `DELETE /profile`
Permanently deletes the user's digital profile, cascades database records, and purges all associated objects in private object storage under `profiles/{userId}/{profileId}/`.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Digital profile and all associated assets deleted successfully."
  }
  ```

---

## 3. Profile Asset Management Endpoints

### 3.1 `POST /profile/assets`
Uploads and preprocesses a user photo (Sharp: orientation auto-rotate, dimension clamping to max 1536px, EXIF metadata stripping, WebP compression, SHA-256 checksum) and stores it in private S3 storage.
- **Authentication:** Bearer JWT required
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file`: Raw image binary (`image/jpeg`, `image/png`, `image/webp`, max 10MB)
  - `photoType`: `FRONT_FULL_BODY` | `UPPER_BODY` | `LOWER_BODY` | `FEET` | `FACE` | `ADDITIONAL`
  - `profileId`: (Optional) Target profile UUID; defaults to user's default profile
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "asset": {
        "id": "e03984be-a196-4458-beb5-85765ce9d04a",
        "profileId": "9fc1f4d4-899e-4212-94b2-3d2ee6015fa8",
        "photoType": "UPPER_BODY",
        "presignedUrl": "http://127.0.0.1:9000/vton-private/profiles/...?X-Amz-Signature=...",
        "width": 1024,
        "height": 1365,
        "fileSizeBytes": 451200,
        "createdAt": "2026-09-26T08:05:00.000Z"
      }
    }
  }
  ```
- **Error Cases:** `400 ImagePreprocessingError`, `400 File Upload Error`, `401 Unauthorized`.

### 3.2 `GET /profile/assets`
Retrieves all profile assets with fresh, short-lived (15 min) pre-signed access URLs.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "assets": [
        {
          "id": "e03984be-a196-4458-beb5-85765ce9d04a",
          "profileId": "9fc1f4d4-899e-4212-94b2-3d2ee6015fa8",
          "photoType": "UPPER_BODY",
          "presignedUrl": "http://127.0.0.1:9000/vton-private/profiles/...?X-Amz-Signature=...",
          "width": 1024,
          "height": 1365,
          "fileSizeBytes": 451200,
          "createdAt": "2026-09-26T08:05:00.000Z"
        }
      ]
    }
  }
  ```

### 3.3 `DELETE /profile/assets/:id`
Deletes a single profile photograph from both PostgreSQL and private S3 object storage.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Profile asset deleted successfully."
  }
  ```
- **Error Cases:** `404 ASSET_NOT_FOUND`, `401 Unauthorized`.

### 3.4 `GET /profile/readiness/:category`
Returns structured readiness details for a specific clothing/accessory category.
- **Authentication:** Bearer JWT required
- **Parameters:** `category` (e.g. `TOPS`, `PANTS`, `SHOES`, `DRESSES`, `JEWELLERY`)
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "readiness": {
        "category": "SHOES",
        "displayName": "Shoes & Footwear",
        "ready": false,
        "activePhotoType": null,
        "requiredPhotoType": "FEET",
        "fallbackPhotoType": "FRONT_FULL_BODY",
        "missingAssets": ["FEET"],
        "recommendedAssets": ["FRONT_FULL_BODY"]
      }
    }
  }
  ```

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
- **Authentication:** Bearer JWT required (Rate Limited: 10 req/min via `tryOnRateLimiter`)
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
    "success": true,
    "data": {
      "jobId": "job-554433",
      "status": "QUEUED",
      "estimatedLatencySeconds": 10,
      "statusUrl": "/api/v1/try-on/jobs/job-554433",
      "createdAt": "2026-09-26T08:10:00Z"
    }
  }
  ```
- **Error Cases:** `400 Validation Error`, `400 Profile Incomplete for Category`, `401 Unauthorized`, `429 Rate Limit Exceeded`.

### 4.2 `GET /try-on/jobs/:id`
Polls the execution status of an active try-on job. Ensures tenant isolation (users can only inspect their own jobs).
- **Authentication:** Bearer JWT required
- **Response (200 OK - Processing):**
  ```json
  {
    "success": true,
    "data": {
      "jobId": "job-554433",
      "status": "PROCESSING",
      "progressPercent": 65,
      "currentStage": "AI Garment Inpainting",
      "updatedAt": "2026-09-26T08:10:06Z"
    }
  }
  ```
- **Response (200 OK - Completed):**
  ```json
  {
    "success": true,
    "data": {
      "jobId": "job-554433",
      "status": "COMPLETED",
      "progressPercent": 100,
      "result": {
        "id": "res-112233",
        "imageUrl": "http://127.0.0.1:9000/vton-private/results/...?X-Amz-Signature=...",
        "width": 1024,
        "height": 1024,
        "latencyMs": 8420,
        "completedAt": "2026-09-26T08:10:09Z"
      }
    }
  }
  ```
- **Response (200 OK - Failed):**
  ```json
  {
    "success": true,
    "data": {
      "jobId": "job-554433",
      "status": "FAILED",
      "errorCode": "GARMENT_IMAGE_UNREACHABLE",
      "errorMessage": "Unable to fetch high-resolution product image from the source website. Please select an alternate image or variant.",
      "canRetry": true
    }
  }
  ```

---

## 5. Results, Wardrobe & Privacy Endpoints

### 5.1 `GET /try-on/history` (Alias: `GET /try-on/results`)
Returns paginated history of all try-on generations for the authenticated user with fresh pre-signed image access URLs.
- **Authentication:** Bearer JWT required
- **Query Params:** `page=1&limit=20`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "res-112233",
          "jobId": "job-554433",
          "productTitle": "Linen Blend Oversized Shirt",
          "category": "SHIRTS",
          "resultImageUrl": "http://127.0.0.1:9000/vton-private/results/...?X-Amz-Signature=...",
          "sourceUrl": "https://www.zara.com/...",
          "createdAt": "2026-09-26T08:10:09Z"
        }
      ],
      "total": 1,
      "page": 1,
      "totalPages": 1
    }
  }
  ```

### 5.2 `GET /try-on/results/:id`
Retrieves a single generated try-on result with pre-signed access URL.
- **Authentication:** Bearer JWT required
- **Response (200 OK):** Matching single result payload.
- **Error Cases:** `404 RESULT_NOT_FOUND`, `401 Unauthorized`.

### 5.3 `DELETE /try-on/results/:id`
Deletes a specific generated try-on result and permanently purges its object storage artifact from private S3/MinIO.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Try-on result deleted successfully"
  }
  ```
- **Error Cases:** `404 RESULT_NOT_FOUND`, `401 Unauthorized`.

### 5.4 `DELETE /user/data` (Alias: `DELETE /auth/me`)
**GDPR Right to Erasure / Privacy Mandate (Assignment §14):**
Permanently and irrevocably purges the user's account, profile photos, try-on history, and all stored objects in private storage.
- **Authentication:** Bearer JWT required
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "User account, profile assets, and try-on history have been permanently purged."
  }
  ```

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
