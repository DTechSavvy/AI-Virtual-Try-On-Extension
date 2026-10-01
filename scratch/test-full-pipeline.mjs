import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Step 1: Check Database User and Profile ---');
  const user = await prisma.user.findFirst({
    where: { email: 'john123@gmail.com' },
    include: {
      profiles: {
        include: { images: true }
      }
    }
  });

  const profile = user?.profiles?.[0];
  if (!user || !profile) {
    console.error('No user profile found');
    process.exit(1);
  }

  console.log('Found User:', user.email, 'Profile ID:', profile.id);
  console.log('Profile Photos:', profile.images.map(img => ({ type: img.photoType, key: img.storageKey })));

  console.log('--- Step 2: Get or Create Test Product ---');
  let product = await prisma.product.findUnique({
    where: { id: 'a193050e-26e5-40fc-858c-b0d2d672dfaf' }
  });

  const validGarmentUrl = 'https://assets.myntassets.com/h_1440,q_100,w_1080/v1/assets/images/2025/OCTOBER/21/Fj6T9fOI_1026b7c32cb7487f92a7e88e0caa4072.jpg';
  console.log('Product Ready:', product.id, product.title);

  console.log('--- Step 3: Trigger Virtual Try-On Job ---');
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: 'USER' },
    'super_secret_jwt_access_key_change_in_production_min_32_chars',
    { expiresIn: 3600 }
  );
  console.log('Auth token acquired for user:', user.email);

  const jobRes = await fetch('http://localhost:4000/api/v1/try-on/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: product.id,
      selectedImageUrl: validGarmentUrl,
      category: 'TOPS',
      generationMode: 'STANDARD'
    })
  }).then(r => r.json());

  console.log('Job Creation Response:', jobRes);
  if (!jobRes.success || !jobRes.data?.jobId) {
    console.error('Failed to create try-on job:', jobRes);
    process.exit(1);
  }

  const jobId = jobRes.data.jobId;
  console.log(`Polling job status for ${jobId}...`);

  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const statusRes = await fetch(`http://localhost:4000/api/v1/try-on/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());

    console.log(`[${i * 4}s] Status:`, statusRes.data?.status, statusRes.data?.progress ? `Progress: ${statusRes.data.progress}%` : '');

    if (statusRes.data?.status === 'COMPLETED') {
      console.log('Try-On Job Completed Successfully!');
      console.log('Result Image URL:', statusRes.data.result?.imageUrl);
      
      const imgFetch = await fetch(statusRes.data.result.imageUrl);
      console.log('Result Image HTTP Status:', imgFetch.status, 'Content-Type:', imgFetch.headers.get('content-type'), 'Bytes:', (await imgFetch.arrayBuffer()).byteLength);
      break;
    }

    if (statusRes.data?.status === 'FAILED') {
      console.error('Job failed:', statusRes.data.errorMessage);
      break;
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
