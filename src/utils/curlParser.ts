import { type RequestState, DEFAULT_REQUEST_STATE, type KeyValuePair, type Method } from '../types';

function tokenize(curlCommand: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < curlCommand.length; i++) {
    const char = curlCommand[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if ((char === ' ' || char === '\t' || char === '\n' || char === '\r') && !inDoubleQuote && !inSingleQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

export function parseCurl(curlString: string): RequestState {
  const normalized = curlString.replace(/\\\s*\n/g, ' ').trim();
  
  let command = normalized;
  if (command.toLowerCase().startsWith('curl ')) {
    command = command.slice(5);
  }

  const tokens = tokenize(command);
  const result: RequestState = JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE));
  
  let method: Method = 'GET';
  let url = '';
  const headers: KeyValuePair[] = [];
  let bodyContent = '';
  let hasBody = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      const nextToken = tokens[i + 1];
      if (nextToken) {
        method = nextToken.toUpperCase() as Method;
        i++;
      }
    } else if (token === '-H' || token === '--header') {
      const nextToken = tokens[i + 1];
      if (nextToken) {
        const colonIdx = nextToken.indexOf(':');
        if (colonIdx > -1) {
          const key = nextToken.slice(0, colonIdx).trim();
          const value = nextToken.slice(colonIdx + 1).trim();
          headers.push({
            id: Math.random().toString(36).substring(2, 9),
            key,
            value,
            enabled: true
          });
        }
        i++;
      }
    } else if (['-d', '--data', '--data-raw', '--data-binary', '--data-urlencode'].includes(token)) {
      const nextToken = tokens[i + 1];
      if (nextToken) {
        bodyContent += (bodyContent ? '&' : '') + nextToken;
        hasBody = true;
        i++;
      }
    } else if (token === '--url') {
      const nextToken = tokens[i + 1];
      if (nextToken) {
        url = nextToken;
        i++;
      }
    } else if (!token.startsWith('-') && !url) {
      url = token;
    }
  }

  // Parse Query Parameters from URL
  const queryParams: KeyValuePair[] = [];
  let cleanUrl = url;
  if (url.includes('?')) {
    const parts = url.split('?');
    cleanUrl = parts[0];
    const queryStr = parts[1];
    const pairs = queryStr.split('&');
    pairs.forEach(pair => {
      const eqIdx = pair.indexOf('=');
      const key = eqIdx > -1 ? decodeURIComponent(pair.slice(0, eqIdx)) : decodeURIComponent(pair);
      const value = eqIdx > -1 ? decodeURIComponent(pair.slice(eqIdx + 1)) : '';
      if (key) {
        queryParams.push({
          id: Math.random().toString(36).substring(2, 9),
          key,
          value,
          enabled: true
        });
      }
    });
  }

  result.method = method;
  result.url = cleanUrl;
  result.params = queryParams;
  result.headers = headers;

  if (hasBody) {
    result.body.type = 'raw';
    result.body.rawType = 'json';
    result.body.rawContent = bodyContent;
    
    const contentTypeHeader = headers.find(h => h.key.toLowerCase() === 'content-type');
    if (contentTypeHeader) {
      const ct = contentTypeHeader.value.toLowerCase();
      if (ct.includes('application/json')) {
        result.body.rawType = 'json';
        try {
          const parsedJson = JSON.parse(bodyContent);
          result.body.rawContent = JSON.stringify(parsedJson, null, 2);
        } catch {
          // ignore parsing error
        }
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        result.body.type = 'x-www-form-urlencoded';
        const uPairs = bodyContent.split('&');
        const urlencodedList: KeyValuePair[] = [];
        uPairs.forEach(pair => {
          const eqIdx = pair.indexOf('=');
          const key = eqIdx > -1 ? decodeURIComponent(pair.slice(0, eqIdx)) : decodeURIComponent(pair);
          const value = eqIdx > -1 ? decodeURIComponent(pair.slice(eqIdx + 1)) : '';
          if (key) {
            urlencodedList.push({
              id: Math.random().toString(36).substring(2, 9),
              key,
              value,
              enabled: true
            });
          }
        });
        result.body.urlencoded = urlencodedList;
      } else if (ct.includes('text/xml') || ct.includes('application/xml')) {
        result.body.rawType = 'xml';
      } else if (ct.includes('text/html')) {
        result.body.rawType = 'html';
      } else {
        result.body.rawType = 'text';
      }
    }
  }

  const authHeader = headers.find(h => h.key.toLowerCase() === 'authorization');
  if (authHeader) {
    const val = authHeader.value;
    if (val.toLowerCase().startsWith('bearer ')) {
      result.auth.type = 'bearer';
      result.auth.state.bearer.token = val.slice(7).trim();
      result.headers = result.headers.filter(h => h.key.toLowerCase() !== 'authorization');
    } else if (val.toLowerCase().startsWith('basic ')) {
      result.auth.type = 'basic';
      try {
        const decoded = atob(val.slice(6).trim());
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > -1) {
          result.auth.state.basic.username = decoded.slice(0, colonIdx);
          result.auth.state.basic.password = decoded.slice(colonIdx + 1);
        }
      } catch {
        // ignore decoding errors
      }
      result.headers = result.headers.filter(h => h.key.toLowerCase() !== 'authorization');
    }
  }

  return result;
}

export function generateCurl(requestState: RequestState): string {
  const { method, url, params, headers, body, auth } = requestState;
  
  const activeParams = params.filter(p => p.enabled && p.key);
  let fullUrl = url || 'https://api.example.com';
  if (activeParams.length > 0) {
    const paramStr = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    fullUrl += (url.includes('?') ? '&' : '?') + paramStr;
  }

  const curlParts = ['curl'];

  if (method !== 'GET') {
    curlParts.push(`-X ${method}`);
  }

  curlParts.push(`"${fullUrl}"`);

  const activeHeaders = [...headers.filter(h => h.enabled && h.key)];

  if (auth.type === 'bearer' && auth.state.bearer.token) {
    activeHeaders.push({ id: '', key: 'Authorization', value: `Bearer ${auth.state.bearer.token}`, enabled: true });
  } else if (auth.type === 'basic' && (auth.state.basic.username || auth.state.basic.password)) {
    const encoded = btoa(`${auth.state.basic.username}:${auth.state.basic.password}`);
    activeHeaders.push({ id: '', key: 'Authorization', value: `Basic ${encoded}`, enabled: true });
  } else if (auth.type === 'apikey' && auth.state.apiKey.addTo === 'headers' && auth.state.apiKey.key) {
    activeHeaders.push({ id: '', key: auth.state.apiKey.key, value: auth.state.apiKey.value, enabled: true });
  }

  activeHeaders.forEach(h => {
    const safeVal = h.value.replace(/"/g, '\\"');
    curlParts.push(`-H "${h.key}: ${safeVal}"`);
  });

  if (method !== 'GET' && method !== 'HEAD') {
    if (body.type === 'raw' && body.rawContent) {
      const escapedBody = body.rawContent.replace(/"/g, '\\"');
      curlParts.push(`-d "${escapedBody}"`);
    } else if (body.type === 'x-www-form-urlencoded') {
      const activeUrlencoded = body.urlencoded.filter(u => u.enabled && u.key);
      if (activeUrlencoded.length > 0) {
        const bodyStr = activeUrlencoded.map(u => `${encodeURIComponent(u.key)}=${encodeURIComponent(u.value)}`).join('&');
        curlParts.push(`-d "${bodyStr}"`);
      }
    } else if (body.type === 'form-data') {
      const activeFormData = body.formData.filter(f => f.enabled && f.key);
      activeFormData.forEach(f => {
        curlParts.push(`-F "${f.key}=${f.value}"`);
      });
    }
  }

  return curlParts.join(' \\\n  ');
}

export function generateFetch(requestState: RequestState): string {
  const { method, url, params, headers, body, auth } = requestState;
  
  const activeParams = params.filter(p => p.enabled && p.key);
  let fullUrl = url || 'https://api.example.com';
  if (activeParams.length > 0) {
    const paramStr = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    fullUrl += (url.includes('?') ? '&' : '?') + paramStr;
  }

  const fetchHeaders: Record<string, string> = {};
  headers.filter(h => h.enabled && h.key).forEach(h => {
    fetchHeaders[h.key] = h.value;
  });

  if (auth.type === 'bearer' && auth.state.bearer.token) {
    fetchHeaders['Authorization'] = `Bearer ${auth.state.bearer.token}`;
  } else if (auth.type === 'basic' && (auth.state.basic.username || auth.state.basic.password)) {
    fetchHeaders['Authorization'] = `Basic ${btoa(`${auth.state.basic.username}:${auth.state.basic.password}`)}`;
  } else if (auth.type === 'apikey' && auth.state.apiKey.addTo === 'headers' && auth.state.apiKey.key) {
    fetchHeaders[auth.state.apiKey.key] = auth.state.apiKey.value;
  }

  const options: Record<string, any> = {
    method: method,
    headers: fetchHeaders
  };

  if (method !== 'GET' && method !== 'HEAD') {
    if (body.type === 'raw' && body.rawContent) {
      options.body = body.rawContent;
    } else if (body.type === 'x-www-form-urlencoded') {
      const activeUrlencoded = body.urlencoded.filter(u => u.enabled && u.key);
      const urlSearchParams = new URLSearchParams();
      activeUrlencoded.forEach(u => urlSearchParams.append(u.key, u.value));
      options.body = `new URLSearchParams(${JSON.stringify(Object.fromEntries(urlSearchParams))})`;
    }
  }

  let code = '';
  if (body.type === 'form-data' && method !== 'GET' && method !== 'HEAD') {
    code += `const formData = new FormData();\n`;
    body.formData.filter(f => f.enabled && f.key).forEach(f => {
      code += `formData.append("${f.key}", "${f.value}");\n`;
    });
    code += `\n`;
  }

  const headersStr = Object.keys(fetchHeaders).length > 0 
    ? `,\n  headers: ${JSON.stringify(fetchHeaders, null, 4).replace(/\n/g, '\n  ')}`
    : '';

  const bodyStr = options.body 
    ? `,\n  body: ${body.type === 'x-www-form-urlencoded' ? options.body : JSON.stringify(options.body)}`
    : '';

  code += `fetch("${fullUrl}", {
  method: "${method}"${headersStr}${bodyStr}
})
  .then(response => response.json())
  .then(result => console.log(result))
  .catch(error => console.log('error', error));`;

  return code;
}

export function generatePythonRequests(requestState: RequestState): string {
  const { method, url, params, headers, body, auth } = requestState;
  
  const pyParams: Record<string, string> = {};
  params.filter(p => p.enabled && p.key).forEach(p => {
    pyParams[p.key] = p.value;
  });

  const pyHeaders: Record<string, string> = {};
  headers.filter(h => h.enabled && h.key).forEach(h => {
    pyHeaders[h.key] = h.value;
  });

  if (auth.type === 'bearer' && auth.state.bearer.token) {
    pyHeaders['Authorization'] = `Bearer ${auth.state.bearer.token}`;
  } else if (auth.type === 'basic' && (auth.state.basic.username || auth.state.basic.password)) {
    pyHeaders['Authorization'] = `Basic ${btoa(`${auth.state.basic.username}:${auth.state.basic.password}`)}`;
  } else if (auth.type === 'apikey' && auth.state.apiKey.addTo === 'headers' && auth.state.apiKey.key) {
    pyHeaders[auth.state.apiKey.key] = auth.state.apiKey.value;
  }

  let code = `import requests\n\nurl = "${url || 'https://api.example.com'}"\n\n`;

  if (Object.keys(pyParams).length > 0) {
    code += `params = ${JSON.stringify(pyParams, null, 4)}\n`;
  }
  if (Object.keys(pyHeaders).length > 0) {
    code += `headers = ${JSON.stringify(pyHeaders, null, 4)}\n`;
  }

  let requestCall = `response = requests.${method.toLowerCase()}(url`;
  if (Object.keys(pyParams).length > 0) requestCall += `, params=params`;
  if (Object.keys(pyHeaders).length > 0) requestCall += `, headers=headers`;

  if (method !== 'GET' && method !== 'HEAD') {
    if (body.type === 'raw' && body.rawContent) {
      if (body.rawType === 'json') {
        try {
          const parsed = JSON.parse(body.rawContent);
          code += `payload = ${JSON.stringify(parsed, null, 4)}\n`;
          requestCall += `, json=payload`;
        } catch {
          code += `payload = ${JSON.stringify(body.rawContent)}\n`;
          requestCall += `, data=payload`;
        }
      } else {
        code += `payload = ${JSON.stringify(body.rawContent)}\n`;
        requestCall += `, data=payload`;
      }
    } else if (body.type === 'x-www-form-urlencoded') {
      const uData: Record<string, string> = {};
      body.urlencoded.filter(u => u.enabled && u.key).forEach(u => {
        uData[u.key] = u.value;
      });
      code += `payload = ${JSON.stringify(uData, null, 4)}\n`;
      requestCall += `, data=payload`;
    } else if (body.type === 'form-data') {
      const fData: Record<string, string> = {};
      body.formData.filter(f => f.enabled && f.key).forEach(f => {
        fData[f.key] = f.value;
      });
      code += `payload = ${JSON.stringify(fData, null, 4)}\n`;
      requestCall += `, data=payload`;
    }
  }

  requestCall += `)\n\nprint(response.text)\n`;
  code += requestCall;

  return code;
}
