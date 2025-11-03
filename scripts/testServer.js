#!/usr/bin/env node
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const port = Number(process.env.UI_TEST_PORT ?? 4173);
const distRoot = resolve(process.cwd(), 'dist');
const extensionRoot = resolve(process.cwd(), 'extension');
const rootDir = existsSync(distRoot) ? distRoot : extensionRoot;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function normalizePath(urlPath) {
  const [cleanPath] = (urlPath ?? '').split('?');
  if (!cleanPath || cleanPath === '/') {
    return '/popup.html';
  }
  return cleanPath;
}

function resolvePath(urlPath) {
  return join(rootDir, normalizePath(urlPath).replace(/^\//, ''));
}

const server = http.createServer((req, res) => {
  try {
    const targetPath = resolvePath(req.url ?? '');
    const fileExt = extname(targetPath);

    statSync(targetPath);

    res.setHeader('Content-Type', mimeTypes[fileExt] ?? 'application/octet-stream');
    createReadStream(targetPath).pipe(res);
  } catch (_error) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.info(`Test server running at http://localhost:${port} (root: ${rootDir})`);
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
