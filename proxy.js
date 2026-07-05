import http from 'http';
import { performance } from 'perf_hooks';

const PORT = 5001;

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/proxy') {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyData);
        const { url, method, headers = {}, body = null } = payload;

        if (!url) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'URL is required' }));
          return;
        }

        const fetchHeaders = { ...headers };

        const options = {
          method,
          headers: fetchHeaders,
        };

        if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
          options.body = body;
        }

        const start = performance.now();
        let response;
        try {
          response = await fetch(url, options);
        } catch (fetchError) {
          const end = performance.now();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 0,
            statusText: 'Network Error',
            headers: {},
            body: fetchError.message,
            timeMs: Math.round(end - start),
            size: 0,
            error: true
          }));
          return;
        }
        
        const end = performance.now();
        const timeMs = Math.round(end - start);

        // Convert response headers to simple object
        const responseHeaders = {};
        response.headers.forEach((val, key) => {
          responseHeaders[key] = val;
        });

        // Determine if response is binary
        const contentType = response.headers.get('content-type') || '';
        const isBinary = contentType.includes('image/') || 
                         contentType.includes('audio/') || 
                         contentType.includes('video/') || 
                         contentType.includes('application/octet-stream') ||
                         contentType.includes('pdf');

        let responseBody = '';
        let size = 0;

        if (isBinary) {
          const buffer = await response.arrayBuffer();
          size = buffer.byteLength;
          responseBody = Buffer.from(buffer).toString('base64');
        } else {
          responseBody = await response.text();
          size = Buffer.byteLength(responseBody, 'utf8');
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseBody,
          isBinary,
          timeMs,
          size
        }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Izlude CORS Proxy Server is running on port ${PORT}`);
});
