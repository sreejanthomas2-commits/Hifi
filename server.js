const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Strip query string
  let urlPath = req.url.split('?')[0];
  // Decode URI encoding
  urlPath = decodeURIComponent(urlPath);
  
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Prevent directory traversal
  urlPath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');

  // Serve from public directory
  let filePath = path.join(__dirname, 'public', urlPath);
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  console.log(`[REQUEST] ${req.method} ${urlPath} -> ${filePath}`);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.error(`[404 NOT FOUND] ${filePath}`);
        res.writeHead(404);
        res.end('File not found: ' + urlPath);
      } else {
        console.error(`[500 ERROR] ${err.message}`);
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
