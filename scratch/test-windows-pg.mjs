import { spawn } from 'child_process';

const passwords = ['postgres', 'password', 'root', 'admin', '123456', 'vton_password', ''];

async function testPassword(pwd) {
  return new Promise((resolve) => {
    const env = { ...process.env, PGPASSWORD: pwd };
    const psql = spawn(
      'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
      ['-U', 'postgres', '-p', '5432', '-h', '127.0.0.1', '-c', 'SELECT 1;'],
      { env }
    );
    let out = '';
    psql.stdout.on('data', (d) => (out += d.toString()));
    psql.stderr.on('data', (d) => (out += d.toString()));
    psql.on('close', (code) => {
      resolve({ pwd, code, out });
    });
  });
}

async function run() {
  for (const pwd of passwords) {
    const res = await testPassword(pwd);
    if (res.code === 0) {
      console.log(`SUCCESS! Password is: "${pwd}"`);
      return;
    } else {
      console.log(`Failed for "${pwd}": ${res.out.trim()}`);
    }
  }
  console.log('None of common passwords worked.');
}

run();
