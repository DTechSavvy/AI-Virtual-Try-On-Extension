import { prisma } from '../backend/dist/config/database.js';

async function main() {
  const jobs = await prisma.tryOnJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { result: true, product: true }
  });
  console.log('Total jobs found:', jobs.length);
  for (const job of jobs) {
    console.log(`Job ${job.id}:`);
    console.log(`  status: ${job.status}, stage: ${job.currentStage}, progress: ${job.progressPercent}%`);
    console.log(`  error: ${job.errorCode} - ${job.errorMessage}`);
    console.log(`  hasResult: ${Boolean(job.result)}, storageKey: ${job.result?.storageKey}`);
    console.log(`  product: ${job.product?.title} (${job.product?.sourceDomain})`);
    console.log(`  createdAt: ${job.createdAt}`);
  }

  const specificJob = await prisma.tryOnJob.findUnique({
    where: { id: '42834e34-d7c9-4a0c-9197-bc20e598b03b' },
    include: { result: true, product: true }
  });
  console.log('\n--- Specific Job 42834e34 ---');
  console.log(JSON.stringify(specificJob, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
