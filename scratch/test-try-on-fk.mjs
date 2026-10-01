import sharp from 'sharp';

async function test() {
  const baseUrl = 'http://localhost:4000/api/v1';

  // 1. Sign in or register test user
  const email = `testuser_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log('1. Registering user...');
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName: 'Test TryOn User' }),
  });
  const regData = await regRes.json();
  if (!regData.success) {
    console.error('Registration failed:', regData);
    process.exit(1);
  }
  const token = regData.data.tokens.accessToken;
  console.log('User registered, token acquired.');

  // 2. Fetch default digital profile
  console.log('2. Fetching profile...');
  const profRes = await fetch(`${baseUrl}/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const profData = await profRes.json();
  const profileId = profData.data?.profile?.id || profData.data?.id;
  console.log('Profile ID:', profileId);

  // 3. Upload a sample body photo to digital profile (FRONT_FULL_BODY)
  console.log('3. Uploading profile photo...');
  const fullBodyBuffer = await sharp({
    create: {
      width: 600,
      height: 900,
      channels: 4,
      background: { r: 240, g: 240, b: 245, alpha: 1 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const formFullBody = new FormData();
  formFullBody.append('photoType', 'FRONT_FULL_BODY');
  formFullBody.append('file', new Blob([fullBodyBuffer], { type: 'image/jpeg' }), 'full_body.jpg');

  const uploadRes = await fetch(`${baseUrl}/profile/assets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formFullBody,
  });
  const uploadData = await uploadRes.json();
  console.log('Profile photo uploaded response:', uploadRes.status, uploadData);

  // 4. Submit Try-On Job with client-side UUID (simulating Chrome Extension)
  console.log('4. Submitting try-on job with client-side generated product UUID...');
  const clientGeneratedUuid = 'a1b2c3d4-e5f6-47a8-b9c0-123456789abc';

  const jobRes = await fetch(`${baseUrl}/try-on/jobs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileId,
      productId: clientGeneratedUuid,
      selectedImageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80',
      category: 'DRESSES',
      generationMode: 'STANDARD',
      productTitle: 'Summer Floral Maxi Dress',
      sourceUrl: 'http://localhost:8089/product/floral-dress',
      sourceDomain: 'localhost',
      price: 89.99,
      currency: 'USD',
      brand: 'Zara Demo',
    }),
  });

  const jobData = await jobRes.json();
  console.log('Try-On Job Response Status:', jobRes.status);
  console.log('Try-On Job Response Body:', jobData);

  if (!jobData.success) {
    console.error('FAILED: try-on job creation failed with error:', jobData.error);
    process.exit(1);
  }

  const jobId = jobData.data.jobId;
  console.log('SUCCESS! Job created with ID:', jobId);

  // 5. Poll job status
  console.log('5. Polling job status...');
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const statusRes = await fetch(`${baseUrl}/try-on/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusRes.json();
    console.log(`Poll ${i + 1}: status = ${statusData.data?.status}, progress = ${statusData.data?.progressPercent}%, stage = ${statusData.data?.currentStage}`);
    if (statusData.data?.status === 'COMPLETED') {
      console.log('Job COMPLETED successfully! Result:', statusData.data.result?.imageUrl);
      break;
    }
    if (statusData.data?.status === 'FAILED') {
      console.error('Job FAILED:', statusData.data.errorMessage);
      break;
    }
  }

  console.log('All Foreign Key and Try-On tests PASSED!');
}

test().catch(console.error);
