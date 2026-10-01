import { PrismaClient } from '@prisma/client';

async function test(port) {
  const url = `postgresql://vton_user:vton_password@127.0.0.1:${port}/vton_db?schema=public`;
  console.log(`Testing port ${port}...`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const res = await prisma.$queryRawUnsafe('SELECT 1 as connected');
    console.log(`Port ${port} SUCCESS:`, res);
    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.log(`Port ${port} FAILED:`, err.message);
    await prisma.$disconnect();
    return false;
  }
}

async function main() {
  await test(5432);
  await test(5433);
}

main();
