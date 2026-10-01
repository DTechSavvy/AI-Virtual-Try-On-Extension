import { S3Client, ListBucketsCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

async function test(accessKeyId, secretAccessKey) {
  console.log(`Testing with ${accessKeyId} / ${secretAccessKey}...`);
  const client = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://127.0.0.1:9000',
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  try {
    const res = await client.send(new ListBucketsCommand({}));
    console.log('ListBuckets SUCCESS:', res.Buckets?.map(b => b.Name));
    return true;
  } catch (e) {
    console.log('ListBuckets FAILED:', e.name, e.message);
    return false;
  }
}

async function main() {
  await test('S3RVER', 'S3RVER');
  await test('minioadmin', 'minioadmin');
  await test('test', 'test');
}

main();
