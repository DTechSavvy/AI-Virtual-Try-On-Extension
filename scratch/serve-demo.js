import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 8089;
const server = http.createServer((req, res) => {
  let filePath = path.resolve('scratch/demo-shop.html');
  if (req.url === '/' || req.url === '/demo-shop.html' || req.url === '/site-a') {
    filePath = path.resolve('scratch/demo-shop.html');
  } else if (req.url === '/listing' || req.url === '/demo-shop-listing.html' || req.url === '/site-b') {
    filePath = path.resolve('scratch/demo-shop-listing.html');
  } else if (req.url.startsWith('/dist/')) {
    filePath = path.resolve('extension' + req.url);
  } else if (req.url.startsWith('/sidepanel/')) {
    filePath = path.resolve('extension/dist/src' + req.url);
  }
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Demo server listening on http://localhost:${PORT}`);
});
