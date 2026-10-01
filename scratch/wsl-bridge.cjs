const net = require('net');
const { spawn } = require('child_process');

function createForwarder(localPort, targetPort) {
  const server = net.createServer((socket) => {
    const child = spawn('wsl.exe', ['-u', 'root', '--', 'nc', '127.0.0.1', String(targetPort)], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    socket.pipe(child.stdin);
    child.stdout.pipe(socket);

    socket.on('error', () => child.kill());
    child.on('error', () => socket.destroy());
    socket.on('close', () => child.kill());
    child.on('close', () => socket.destroy());
  });

  server.listen(localPort, '127.0.0.1', () => {
    console.log(`[WSL Bridge] 127.0.0.1:${localPort} -> WSL 127.0.0.1:${targetPort}`);
  });

  return server;
}

// 5433 -> Postgres (5433 in WSL)
createForwarder(5433, 5433);
// 6379 -> Redis (6379 in WSL)
createForwarder(6379, 6379);
// 9000 -> MinIO (9000 in WSL)
createForwarder(9000, 9000);
