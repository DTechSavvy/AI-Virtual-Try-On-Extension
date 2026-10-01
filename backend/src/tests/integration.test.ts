import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import app, { initServices } from '../main.js';
import { prisma } from '../config/database.js';
import { storageService } from '../services/storage.service.js';

describe('Phase 2 — Comprehensive Backend Integration Verification Suite', () => {
  const testEmail = `test_user_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword123!';
  let accessToken = '';
  let refreshToken = '';
  let userId = '';
  let defaultProfileId = '';
  let uploadedAssetId = '';
  let uploadedStorageKey = '';

  beforeAll(async () => {
    await initServices();
  });

  afterAll(async () => {
    // Cleanup any test user data from DB and S3
    if (userId) {
      await storageService.deletePrefix(`profiles/${userId}/`);
      await prisma.user.deleteMany({ where: { email: testEmail } });
    }
  });

  // --------------------------------------------------------------------------
  // 1 & 2. Health & Database Connectivity Check
  // --------------------------------------------------------------------------
  it('1 & 2. GET /api/v1/health returns healthy status with live database and storage', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('up');
    expect(res.body.services.storage).toBe('up');
    expect(res.body.categoriesSupported).toContain('TOPS');
  });

  // --------------------------------------------------------------------------
  // 3 & 4. Registration & Duplicate Registration Rejection
  // --------------------------------------------------------------------------
  it('3. POST /api/v1/auth/register registers a new user with hashed password and default profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        displayName: 'Integration Tester',
        consentTraining: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.user.passwordHash).toBeUndefined(); // Never exposed
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    userId = res.body.data.user.id;
    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;

    // Verify DB integrity: default profile created
    const profile = await prisma.digitalProfile.findFirst({ where: { userId } });
    expect(profile).not.toBeNull();
    defaultProfileId = profile!.id;
  });

  it('4. POST /api/v1/auth/register rejects duplicate registration with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body.title).toBe('Authentication Error');
    expect(res.body.detail).toContain('already exists');
  });

  // --------------------------------------------------------------------------
  // 5 & 6. Login & Invalid Login Rejection
  // --------------------------------------------------------------------------
  it('5. POST /api/v1/auth/login logs in with valid credentials and issues fresh tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    // Update tokens for subsequent requests
    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;
  });

  it('6. POST /api/v1/auth/login rejects invalid password with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Authentication Error');
  });

  // --------------------------------------------------------------------------
  // 7. Authenticated /auth/me
  // --------------------------------------------------------------------------
  it('7. GET /api/v1/auth/me returns current user summary when authenticated', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(userId);
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
  });

  // --------------------------------------------------------------------------
  // 8. Refresh Token Rotation
  // --------------------------------------------------------------------------
  it('8. POST /api/v1/auth/refresh rotates refresh token and returns new access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    const oldRefreshToken = refreshToken;
    accessToken = res.body.data.tokens.accessToken;
    refreshToken = res.body.data.tokens.refreshToken;

    // Verify rotation: used token should be rejected if attempted again
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(reuseRes.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // 9. Logout
  // --------------------------------------------------------------------------
  it('9. POST /api/v1/auth/logout revokes refresh token session', async () => {
    // Generate a temporary login session to logout
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testEmail, password: testPassword });

    const tempRefreshToken = loginRes.body.data.tokens.refreshToken;

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: tempRefreshToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // Verify revoked token cannot be refreshed
    const revokedRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: tempRefreshToken });

    expect(revokedRefreshRes.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // 10. Unauthorized profile access rejection
  // --------------------------------------------------------------------------
  it('10. Rejects unauthorized access to protected profile endpoints without token', async () => {
    const res = await request(app).get('/api/v1/profile');
    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });

  // --------------------------------------------------------------------------
  // 11. Profile creation
  // --------------------------------------------------------------------------
  it('11. POST /api/v1/profile creates a new digital profile', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Summer Wardrobe Profile',
        isDefault: false,
        measurements: {
          heightCm: 175,
          chestCm: 96,
          waistCm: 82,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.name).toBe('Summer Wardrobe Profile');
    expect(res.body.data.profile.measurements.heightCm).toBe(175);
  });

  // --------------------------------------------------------------------------
  // 12. Profile retrieval
  // --------------------------------------------------------------------------
  it('12. GET /api/v1/profile retrieves the default profile with completeness breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profile.id).toBe(defaultProfileId);
    expect(res.body.data.profile.completeness).toBeDefined();
    expect(res.body.data.profile.completeness.overallPercentage).toBe(0); // Initially empty
  });

  // --------------------------------------------------------------------------
  // 13. Profile update
  // --------------------------------------------------------------------------
  it('13. PATCH /api/v1/profile updates profile metadata and measurements', async () => {
    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'My Primary VTON Profile',
        measurements: {
          heightCm: 180,
          waistCm: 84,
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.name).toBe('My Primary VTON Profile');
    expect(res.body.data.profile.measurements.heightCm).toBe(180);
  });

  // --------------------------------------------------------------------------
  // 14. Image upload & Sharp Preprocessing & S3 Private Storage
  // --------------------------------------------------------------------------
  it('14. POST /api/v1/profile/assets processes and uploads a valid profile photo to S3', async () => {
    // Generate valid sample image buffer using sharp
    const testImageBuffer = await sharp({
      create: {
        width: 600,
        height: 800,
        channels: 3,
        background: { r: 120, g: 140, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('photoType', 'UPPER_BODY')
      .attach('file', testImageBuffer, 'sample_photo.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.asset.id).toBeDefined();
    expect(res.body.data.asset.photoType).toBe('UPPER_BODY');
    expect(res.body.data.asset.presignedUrl).toContain('http');
    expect(res.body.data.asset.width).toBe(600);
    expect(res.body.data.asset.height).toBe(800);

    uploadedAssetId = res.body.data.asset.id;

    // Verify object reference in DB
    const dbImage = await prisma.profileImage.findUnique({ where: { id: uploadedAssetId } });
    expect(dbImage).not.toBeNull();
    uploadedStorageKey = dbImage!.storageKey;
    expect(uploadedStorageKey).toMatch(/^profiles\/[a-f0-9-]+\/[a-f0-9-]+\/UPPER_BODY_[a-f0-9-]+\.webp$/);

    // 22. Private Object Storage verification: file physically exists in S3
    const exists = await storageService.exists(uploadedStorageKey);
    expect(exists).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 15. Invalid file rejection
  // --------------------------------------------------------------------------
  it('15. POST /api/v1/profile/assets rejects invalid/corrupt non-image files with 400', async () => {
    const corruptBuffer = Buffer.from('This is a text file, not an image binary');

    const res = await request(app)
      .post('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('photoType', 'UPPER_BODY')
      .attach('file', corruptBuffer, 'corrupt.jpg');

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Image Preprocessing Error');
  });

  // --------------------------------------------------------------------------
  // 16. Undersized / Malformed dimension rejection
  // --------------------------------------------------------------------------
  it('16. POST /api/v1/profile/assets rejects undersized images below min threshold', async () => {
    const tinyBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const res = await request(app)
      .post('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('photoType', 'UPPER_BODY')
      .attach('file', tinyBuffer, 'tiny.png');

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Image Preprocessing Error');
    expect(res.body.detail).toContain('too small');
  });

  // --------------------------------------------------------------------------
  // 17. Profile asset retrieval
  // --------------------------------------------------------------------------
  it('17. GET /api/v1/profile/assets returns all profile assets with pre-signed access URLs', async () => {
    const res = await request(app)
      .get('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.assets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.assets[0].presignedUrl).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // 18. Profile Completeness calculation
  // --------------------------------------------------------------------------
  it('18. GET /api/v1/profile reflects updated completeness after photo upload', async () => {
    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const { completeness } = res.body.data.profile;
    expect(completeness.availablePhotoTypes).toContain('UPPER_BODY');
    expect(completeness.overallPercentage).toBe(20); // 1 out of 5 core photo types
    expect(completeness.supportedCategories).toContain('TOPS');
  });

  // --------------------------------------------------------------------------
  // 19. Category-specific readiness evaluation
  // --------------------------------------------------------------------------
  it('19. GET /api/v1/profile/readiness/:category evaluates readiness accurately', async () => {
    // With UPPER_BODY uploaded, TOPS should be ready
    const topsRes = await request(app)
      .get('/api/v1/profile/readiness/TOPS')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(topsRes.status).toBe(200);
    expect(topsRes.body.data.readiness.ready).toBe(true);
    expect(topsRes.body.data.readiness.activePhotoType).toBe('UPPER_BODY');

    // SHOES requires FEET or FRONT_FULL_BODY, so should NOT be ready
    const shoesRes = await request(app)
      .get('/api/v1/profile/readiness/SHOES')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(shoesRes.status).toBe(200);
    expect(shoesRes.body.data.readiness.ready).toBe(false);
    expect(shoesRes.body.data.readiness.missingAssets).toContain('FEET');
    expect(shoesRes.body.data.readiness.recommendedAssets).toContain('FRONT_FULL_BODY');
  });

  // --------------------------------------------------------------------------
  // 20. Individual asset deletion
  // --------------------------------------------------------------------------
  it('20. DELETE /api/v1/profile/assets/:id removes single asset from DB and S3', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/profile/assets/${uploadedAssetId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify DB removal
    const dbImage = await prisma.profileImage.findUnique({ where: { id: uploadedAssetId } });
    expect(dbImage).toBeNull();

    // Verify S3 removal
    const exists = await storageService.exists(uploadedStorageKey);
    expect(exists).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 21, 23 & 24. Profile deletion, S3 prefix purge & Referential Integrity
  // --------------------------------------------------------------------------
  it('21, 23 & 24. DELETE /api/v1/profile deletes profile, cascades images and purges S3 prefix', async () => {
    // Upload a new asset to test prefix purge
    const testImageBuffer = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 3,
        background: { r: 50, g: 150, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const uploadRes = await request(app)
      .post('/api/v1/profile/assets')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('photoType', 'FACE')
      .attach('file', testImageBuffer, 'face.png');

    expect(uploadRes.status).toBe(201);
    const assetKey = (await prisma.profileImage.findUnique({ where: { id: uploadRes.body.data.asset.id } }))!.storageKey;
    expect(await storageService.exists(assetKey)).toBe(true);

    // Delete entire default profile
    const deleteProfileRes = await request(app)
      .delete('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(deleteProfileRes.status).toBe(200);

    // 24. Database integrity: profile deleted
    const profileInDb = await prisma.digitalProfile.findUnique({ where: { id: defaultProfileId } });
    expect(profileInDb).toBeNull();

    // 23. Storage cleanup: asset is purged from S3
    const assetExistsAfterProfileDelete = await storageService.exists(assetKey);
    expect(assetExistsAfterProfileDelete).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 25. Error handling and RFC 7807 compliance
  // --------------------------------------------------------------------------
  it('25. Centralized error handling returns compliant RFC 7807 problem details without leaking secrets', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' }); // Invalid name violating validation

    expect(res.status).toBe(400);
    expect(res.body.type).toContain('validation-error');
    expect(res.body.title).toBe('Validation Error');
    expect(res.body.correlationId).toBeDefined();
    expect(res.body.invalidParams).toBeDefined();

    // Verify sensitive data or stack traces are not leaked in body
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('minioadmin');
  });
});
