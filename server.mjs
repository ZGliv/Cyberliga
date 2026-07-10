import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ROOT_REAL = await realpath(ROOT);
const HOST = (process.env.HOST || '127.0.0.1').trim();
const rawPort = process.env.PORT || '4173';
const PORT = Number(rawPort);

if (!HOST || !Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  console.error(`[cyberliga] Invalid server address: HOST=${JSON.stringify(HOST)} PORT=${JSON.stringify(rawPort)}`);
  process.exit(1);
}

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.wasm', 'application/wasm'],
  ['.gltf', 'model/gltf+json'],
  ['.glb', 'model/gltf-binary'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm']
]);

const LONG_CACHE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.otf', '.glb', '.gltf', '.mp3', '.wav',
  '.ogg', '.mp4', '.webm', '.wasm'
]);

function sendText(response, status, message, extraHeaders = {}) {
  const body = `${message}\n`;
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  response.end(body);
}

function parseRequestPath(requestUrl) {
  let pathname;
  try {
    pathname = new URL(requestUrl || '/', 'http://localhost').pathname;
    pathname = decodeURIComponent(pathname).replaceAll('\\', '/');
  } catch {
    return { error: 'Malformed request path.' };
  }

  if (pathname.includes('\0')) return { error: 'Malformed request path.' };
  if (pathname === '/') pathname = '/world.html';

  const segments = pathname.split('/');
  if (segments.some((segment) => segment === '..' || segment.startsWith('.'))) {
    return { error: 'Path is outside the public application.' };
  }

  let target = path.resolve(ROOT, `.${pathname}`);
  if (!path.extname(target)) target += '.html';
  const relative = path.relative(ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return { error: 'Path is outside the public application.' };
  }
  return { pathname, target };
}

function cacheControlFor(extension) {
  if (extension === '.html' || extension === '.htm') return 'no-store';
  if (LONG_CACHE_EXTENSIONS.has(extension)) return 'public, max-age=3600';
  return 'no-cache';
}

function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { invalid: true };

  let start = match[1] === '' ? null : Number(match[1]);
  let end = match[2] === '' ? null : Number(match[2]);
  if (start === null && end === null) return { invalid: true };

  if (start === null) {
    const suffixLength = end;
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return { invalid: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    if (!Number.isInteger(start) || start < 0 || start >= size) return { invalid: true };
    end = end === null ? size - 1 : end;
    if (!Number.isInteger(end) || end < start) return { invalid: true };
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

const server = createServer(async (request, response) => {
  const startedAt = performance.now();
  const method = request.method || 'GET';
  response.once('finish', () => {
    const elapsed = Math.max(0, performance.now() - startedAt).toFixed(1);
    console.log(`[cyberliga] ${response.statusCode} ${method} ${request.url || '/'} ${elapsed}ms`);
  });

  if (method !== 'GET' && method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const parsed = parseRequestPath(request.url);
  if (parsed.error) {
    sendText(response, 400, parsed.error);
    return;
  }

  let fileInfo;
  let realTarget;
  try {
    fileInfo = await stat(parsed.target);
    realTarget = await realpath(parsed.target);
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      sendText(response, 404, 'Not Found');
      return;
    }
    console.error(`[cyberliga] Failed to inspect ${parsed.pathname}:`, error);
    sendText(response, 500, 'Internal Server Error');
    return;
  }

  const realRelative = path.relative(ROOT_REAL, realTarget);
  if (!fileInfo.isFile() || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    sendText(response, 404, 'Not Found');
    return;
  }

  const extension = path.extname(realTarget).toLowerCase();
  const contentType = MIME_TYPES.get(extension) || 'application/octet-stream';
  const etag = `W/\"${fileInfo.size.toString(16)}-${Math.trunc(fileInfo.mtimeMs).toString(16)}\"`;
  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControlFor(extension),
    'Content-Type': contentType,
    ETag: etag,
    'Last-Modified': fileInfo.mtime.toUTCString(),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff'
  };

  if (request.headers['if-none-match'] === etag) {
    response.writeHead(304, baseHeaders);
    response.end();
    return;
  }

  const range = parseRange(request.headers.range, fileInfo.size);
  if (range && range.invalid) {
    sendText(response, 416, 'Range Not Satisfiable', { 'Content-Range': `bytes */${fileInfo.size}` });
    return;
  }

  const status = range ? 206 : 200;
  const start = range ? range.start : 0;
  const end = range ? range.end : fileInfo.size - 1;
  const headers = {
    ...baseHeaders,
    'Content-Length': Math.max(0, end - start + 1)
  };
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${fileInfo.size}`;
  response.writeHead(status, headers);
  if (method === 'HEAD' || fileInfo.size === 0) {
    response.end();
    return;
  }

  const stream = createReadStream(realTarget, { start, end });
  stream.on('error', (error) => {
    console.error(`[cyberliga] Failed while streaming ${parsed.pathname}:`, error);
    if (!response.headersSent) sendText(response, 500, 'Internal Server Error');
    else response.destroy(error);
  });
  stream.pipe(response);
});

server.on('clientError', (error, socket) => {
  console.warn('[cyberliga] Rejected malformed HTTP request:', error.message);
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[cyberliga] Cannot start: ${HOST}:${PORT} is already in use. Stop the old preview or choose another PORT.`);
  } else if (error.code === 'EACCES') {
    console.error(`[cyberliga] Cannot bind ${HOST}:${PORT}: permission denied.`);
  } else {
    console.error('[cyberliga] Server failed:', error);
  }
  process.exitCode = 1;
});

server.listen({ host: HOST, port: PORT }, () => {
  const address = server.address();
  const activePort = typeof address === 'object' && address ? address.port : PORT;
  console.log(`[cyberliga] Dev server ready at http://${HOST}:${activePort}/`);
  console.log(`[cyberliga] Serving ${ROOT_REAL} (root opens world.html; Ctrl+C stops cleanly)`);
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`[cyberliga] ${signal} received; closing active connections...`);
  const forceTimer = setTimeout(() => {
    console.error('[cyberliga] Graceful shutdown timed out; exiting.');
    process.exit(1);
  }, 5000);
  forceTimer.unref();
  server.close((error) => {
    clearTimeout(forceTimer);
    if (error) {
      console.error('[cyberliga] Shutdown failed:', error);
      process.exit(1);
    }
    console.log('[cyberliga] Server stopped.');
    process.exit(0);
  });
  server.closeIdleConnections?.();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
