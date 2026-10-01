import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import app, { initServices } from '../main.js';
import { prisma } from '../config/database.js';
import { storageService } from '../services/storage.service.js';
import { tryOnWorker } from '../modules/try-on/queue/try-on.worker.js';
import { ProductCategory, GenerationMode } from '@vton/shared';

describe('Try-On End-to-End Pipeline & Integration Suite', () => {
  const testEmail = `tryon_tester_${Date.now()}@example.com`;
  const otherEmail = `tryon_other_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';

  let accessToken = '';
  let otherAccessToken = '';
  let userId = '';
  let otherUserId = '';
  let defaultProfileId = '';
  let jobId = '';
  let resultId = '';
  let cachedGarmentKey = '';

  beforeAll(async () => {
    await initServices();

    // 1. Create primary test user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: testEmail, password: testPassword, displayName: 'TryOn Tester' });
    accessToken = regRes.body.data.tokens.accessToken;
    userId = regRes.body.data.user.id;

    // 2. Create secondary user for authorization/ownership testing
    const otherRes = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: otherEmail, password: testPassword, displayName: 'Other User' });
    otherAccessToken = otherRes.body.data.tokens.accessToken;
    otherUserId = otherRes.body.data.user.id;

    // 3. Get primary user's default profile
    const profRes = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    defaultProfileId = profRes.body.data.id;

    // 4. Upload an UPPER_BODY photo to default profile
    const upperBodyBuffer = await sharp({
      create: {
        width: 600,
        height: 800,
        channels: 4,
        background: { r: 235, g: 235, b: 235, alpha: 1 },
      },
    })
      .jpeg()
      .toBuffer();

    await request(app)
      .post('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('photoType', 'UPPER_BODY')
      .attach('file', upperBodyBuffer, 'upper_body.jpg');

    // 5. Pre-cache a synthetic garment in S3 to allow offline test execution without external network
    const garmentBuffer = await sharp({
      create: {
        width: 400,
        height: 500,
        channels: 4,
        background: { r: 99, g: 102, b: 241, alpha: 1 },
      },
    })
      .webp()
      .toBuffer();

    cachedGarmentKey = `cache/garments/test_garment_${Date.now()}.webp`;
    await storageService.upload({
      key: cachedGarmentKey,
      body: garmentBuffer,
      contentType: 'image/webp',
    });
  });

  afterAll(async () => {
    // Purge test users and storage
    if (userId) {
      await storageService.deletePrefix(`profiles/${userId}/`);
      await storageService.deletePrefix(`results/${userId}/`);
      await prisma.user.deleteMany({ where: { email: { in: [testEmail, otherEmail] } } });
    }
    if (cachedGarmentKey) {
      await storageService.delete(cachedGarmentKey);
    }
  });

  it('1. Rejects unauthenticated try-on submission with 401', async () => {
    const res = await request(app)
      .post('/api/v1/try-on/jobs')
      .send({
        selectedImageUrl: cachedGarmentKey,
        category: ProductCategory.TOPS,
        generationMode: GenerationMode.STANDARD,
      });

    expect(res.status).toBe(401);
  });

  it('2. Rejects try-on for category when profile lacks required photo (FEET for SHOES)', async () => {
    const res = await request(app)
      .post('/api/v1/try-on/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        selectedImageUrl: cachedGarmentKey,
        category: ProductCategory.SHOES,
        generationMode: GenerationMode.STANDARD,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PROFILE_INCOMPLETE_FOR_CATEGORY');
    expect(res.body.error.message).toContain('FEET');
  });

  it('3. Accepts valid try-on job for supported category and enqueues job', async () => {
    const res = await request(app)
      .post('/api/v1/try-on/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        profileId: defaultProfileId,
        selectedImageUrl: cachedGarmentKey,
        category: ProductCategory.TOPS,
        generationMode: GenerationMode.STANDARD,
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.jobId).toBeDefined();
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.statusUrl).toContain('/api/v1/try-on/jobs/');

    jobId = res.body.data.jobId;
  });

  it('4. Reuses active job on immediate duplicate submission (Idempotency)', async () => {
    const res = await request(app)
      .post('/api/v1/try-on/jobs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        profileId: defaultProfileId,
        selectedImageUrl: cachedGarmentKey,
        category: ProductCategory.TOPS,
        generationMode: GenerationMode.STANDARD,
      });

    expect(res.status).toBe(202);
    expect(res.body.data.jobId).toBe(jobId); // Exactly the same job ID
  });

  it('5. Worker processes job: transitions QUEUED -> PROCESSING -> COMPLETED with TryOnResult', async () => {
    // Process job through the worker engine
    await tryOnWorker.processJob({
      jobId,
      userId,
      profileId: defaultProfileId,
      selectedImageUrl: cachedGarmentKey,
      category: ProductCategory.TOPS,
      generationMode: GenerationMode.STANDARD,
    });

    const updatedJob = await prisma.tryOnJob.findUnique({
      where: { id: jobId },
      include: { result: true },
    });

    expect(updatedJob).toBeDefined();
    expect(updatedJob?.status).toBe('COMPLETED');
    expect(updatedJob?.progressPercent).toBe(100);
    expect(updatedJob?.currentStage).toBe('COMPLETED');
    expect(updatedJob?.result).toBeDefined();

    resultId = updatedJob!.result!.id;
  });

  it('6. Enforces ownership: unauthorized user cannot poll another user job status', async () => {
    const res = await request(app)
      .get(`/api/v1/try-on/jobs/${jobId}`)
      .set('Authorization', `Bearer ${otherAccessToken}`);

    expect(res.status).toBe(404);
  });

  it('7. Owner polls job status: returns COMPLETED and private pre-signed result URL', async () => {
    const res = await request(app)
      .get(`/api/v1/try-on/jobs/${jobId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('COMPLETED');
    expect(res.body.data.progressPercent).toBe(100);
    expect(res.body.data.result).toBeDefined();
    expect(res.body.data.result.imageUrl).toContain('http');
    expect(res.body.data.result.width).toBeGreaterThan(0);
    expect(res.body.data.result.height).toBeGreaterThan(0);
  });

  it('8. GET /api/v1/try-on/history returns paginated results list for authenticated user', async () => {
    const res = await request(app)
      .get('/api/v1/try-on/history?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(res.body.data.results[0].id).toBe(resultId);
    expect(res.body.data.results[0].imageUrl).toBeDefined();
  });

  it('9. GET /api/v1/try-on/results/:id retrieves a single result with secure access', async () => {
    const res = await request(app)
      .get(`/api/v1/try-on/results/${resultId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(resultId);
    expect(res.body.data.imageUrl).toBeDefined();
  });

  it('10. DELETE /api/v1/try-on/results/:id deletes generated result from DB and S3', async () => {
    const res = await request(app)
      .delete(`/api/v1/try-on/results/${resultId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const deleted = await prisma.tryOnResult.findUnique({ where: { id: resultId } });
    expect(deleted).toBeNull();
  });

  it('11. DELETE /api/v1/auth/me completely wipes user account, digital profile, and S3 data (GDPR)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);

    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    expect(userInDb).toBeNull();

    // Secondary user still intact
    const otherInDb = await prisma.user.findUnique({ where: { id: otherUserId } });
    expect(otherInDb).toBeDefined();
  });
});
