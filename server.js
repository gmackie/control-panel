const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || 3000;

// When using Next.js standalone mode
const app = next({ 
  dev,
  hostname,
  port,
  dir: __dirname,
  conf: {
    distDir: '.next'
  }
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;

      // Handle static files from .next/static
      if (pathname.startsWith('/_next/static')) {
        const filePath = path.join(__dirname, '.next', 'static', pathname.replace('/_next/static', ''));
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.writeHead(200, {
            'Content-Type': getContentType(filePath),
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      // Handle public files
      if (pathname.startsWith('/') && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
        const publicPath = path.join(__dirname, 'public', pathname);
        if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
          const stat = fs.statSync(publicPath);
          res.writeHead(200, {
            'Content-Type': getContentType(publicPath),
            'Content-Length': stat.size,
            'Cache-Control': 'public, max-age=3600'
          });
          fs.createReadStream(publicPath).pipe(res);
          return;
        }
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return types[ext] || 'application/octet-stream';
}