import React, { useState } from 'react';
import { Copy, Check, Terminal, ExternalLink, Search } from 'lucide-react';
import { type ResponseState, type RequestState } from '../types';
import { generateCurl, generateFetch, generatePythonRequests } from '../utils/curlParser';
import CodeMirror from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { notionThemeExtension } from '../utils/codemirrorTheme';

interface ResponsePanelProps {
  response: ResponseState | null;
  requestState: RequestState;
  isLoading: boolean;
}

export const ResponsePanel: React.FC<ResponsePanelProps> = ({
  response,
  requestState,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'code' | 'table' | 'preview'>('body');
  const [prettyFormat, setPrettyFormat] = useState<boolean>(true);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'fetch' | 'python'>('curl');
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [jsonFilter, setJsonFilter] = useState('');

  const statusExplainer: Record<number, string> = {
    200: 'OK - คำขอสำเร็จลุล่วงและข้อมูลถูกส่งกลับมาเรียบร้อยแล้ว',
    201: 'Created - ข้อมูลถูกสร้างสำเร็จบนเซิร์ฟเวอร์แล้ว',
    400: 'Bad Request - คำขอไม่ถูกต้อง ตรวจสอบความถูกต้องของ JSON syntax, Params หรือ Headers',
    401: 'Unauthorized - ไม่ได้รับอนุญาต ตรวจสอบโทเค็นความปลอดภัย (Bearer Token / API Key)',
    403: 'Forbidden - สิทธิ์การเข้าถึงไม่เพียงพอ เซิร์ฟเวอร์ปฏิเสธการประมวลผลคำขอนี้',
    404: 'Not Found - ไม่พบที่อยู่หรือทรัพยากรที่ร้องขอ ตรวจสอบความถูกต้องของ URL Path',
    405: 'Method Not Allowed - เซิร์ฟเวอร์ไม่รองรับ HTTP method นี้สำหรับ URL ปลายทางดังกล่าว',
    500: 'Internal Server Error - เซิร์ฟเวอร์ขัดข้องภายใน กรุณาตรวจสอบบันทึกข้อผิดพลาด (Server Logs)',
    502: 'Bad Gateway - เซิร์ฟเวอร์ที่ทำหน้าที่เป็นทางผ่านได้รับผลลัพธ์ที่ไม่ถูกต้องจากเซิร์ฟเวอร์ต้นทาง',
    503: 'Service Unavailable - เซิร์ฟเวอร์ไม่พร้อมใช้งานชั่วคราว (เช่น กำลังบำรุงรักษา หรือโอเวอร์โหลด)',
    0: 'CORS/Network Error - การเชื่อมต่อล้มเหลว กรุณาเปิดใช้งาน CORS บนฝั่งเซิร์ฟเวอร์ หรือตรวจสอบการตั้งค่าเครือข่าย'
  };

  const getStatusExplainer = (code: number): string | null => {
    if (code === 200 || code === 201) return null;
    return statusExplainer[code] || statusExplainer[0];
  };

  const getValueByPath = (obj: any, path: string): any => {
    if (!path.trim()) return obj;
    try {
      const cleanPath = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
      const parts = cleanPath.split('.');
      let current = obj;
      for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        current = current[part];
      }
      return current;
    } catch {
      return undefined;
    }
  };

  if (isLoading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '12px' }}>
        <div className="spinner" style={{
          width: '24px',
          height: '24px',
          border: '2px solid var(--border-color)',
          borderTopColor: 'var(--text-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <span style={{ fontSize: '13px' }}>Executing Request...</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!response) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '10px', padding: '40px', textAlign: 'center' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-secondary)',
          marginBottom: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <Terminal size={22} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
        </div>
        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>Awaiting Request Send</h3>
        <p style={{ fontSize: '12.5px', opacity: 0.8, maxWidth: '280px', lineHeight: '1.5' }}>
          Configure your method, endpoint, parameters, and headers above, then click Send to execute.
        </p>
      </div>
    );
  }

  const { status, statusText, headers, body, isBinary, timeMs, size } = response;

  const isRedirect = status >= 300 && status < 400;
  const isClientError = status >= 400 && status < 500;
  const isServerError = status >= 500;

  let statusClass = 'success';
  if (isRedirect || isClientError) statusClass = 'warning';
  if (isServerError || status === 0) statusClass = 'danger';

  // Format Size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Pretty Print Body
  const getFormattedBody = () => {
    if (isBinary) {
      const contentType = headers['content-type'] || 'image/png';
      return (
        <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
          {contentType.includes('image/') ? (
            <img 
              src={`data:${contentType};base64,${body}`} 
              alt="Response payload" 
              style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', border: '1px solid var(--border-color)' }} 
            />
          ) : (
            <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ExternalLink size={16} />
              <span>Binary content ({contentType}) - Base64 encoded: {body.substring(0, 100)}...</span>
            </div>
          )}
        </div>
      );
    }

    if (!body) return 'Empty Response Body';

    let jsonObject: any = null;
    let isJson = false;
    try {
      const contentType = headers['content-type'] || '';
      if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
        jsonObject = JSON.parse(body);
        isJson = true;
      }
    } catch {}

    if (isJson && jsonFilter.trim()) {
      const filteredVal = getValueByPath(jsonObject, jsonFilter);
      if (filteredVal === undefined) return `Path not found: "${jsonFilter}"`;
      return JSON.stringify(filteredVal, null, 2);
    }

    if (prettyFormat && isJson && jsonObject) {
      return JSON.stringify(jsonObject, null, 2);
    }

    return body;
  };

  const formattedBody = getFormattedBody();

  const handleCopyBody = () => {
    if (!isBinary && body) {
      navigator.clipboard.writeText(body);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
  };

  const getCodeSnippet = () => {
    switch (snippetLang) {
      case 'curl': return generateCurl(requestState);
      case 'fetch': return generateFetch(requestState);
      case 'python': return generatePythonRequests(requestState);
      default: return '';
    }
  };

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const getJsonArray = (): any[] | null => {
    try {
      if (!body) return null;
      const parsed = JSON.parse(body);
      if (Array.isArray(parsed)) return parsed;
      return null;
    } catch {
      return null;
    }
  };

  const jsonArray = getJsonArray();
  const isHtmlResponse = body?.trim().startsWith('<!DOCTYPE') || body?.trim().startsWith('<html') || (headers['content-type'] || '').includes('text/html');
  const isJson = (() => {
    try {
      if (!body) return false;
      const contentType = headers['content-type'] || '';
      return contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[');
    } catch {
      return false;
    }
  })();

  const renderTable = (arr: any[]) => {
    if (arr.length === 0) return <div style={{ fontSize: '13px', fontStyle: 'italic', padding: '12px' }}>Empty Array</div>;
    const keys = Array.from(new Set(arr.flatMap(item => typeof item === 'object' && item !== null ? Object.keys(item) : [])));
    
    if (keys.length === 0) {
      return (
        <table className="notion-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {arr.map((val, idx) => (
              <tr key={idx}>
                <td style={{ color: 'var(--text-secondary)' }}>{idx}</td>
                <td>{String(val)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="notion-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              {keys.map(k => <th key={k}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {arr.map((item, idx) => (
              <tr key={idx}>
                <td style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{idx + 1}</td>
                {keys.map(k => {
                  const val = item[k];
                  let displayVal = '';
                  if (val === null) displayVal = 'null';
                  else if (val === undefined) displayVal = '';
                  else if (typeof val === 'object') displayVal = JSON.stringify(val);
                  else displayVal = String(val);
                  
                  return (
                    <td key={k} style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      maxWidth: '220px'
                    }} title={displayVal}>
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Response Header Status Panel */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '12px 24px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)' }}>Response</span>
          <span className={`status-badge ${statusClass}`}>
            {status} {statusText}
          </span>
        </div>

        {status > 0 && (
          <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div>Time: <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{timeMs} ms</span></div>
            <div>Size: <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{formatSize(size)}</span></div>
          </div>
        )}
      </div>

      {/* HTTP Status Code Explainer Card (Feature 3) */}
      {status > 0 && getStatusExplainer(status) && (
        <div style={{ padding: '0 24px' }}>
          <div className="notion-callout danger" style={{ marginTop: '12px', marginBottom: '0px' }}>
            <div className="notion-callout-icon">⚠️</div>
            <div className="notion-callout-content">
              <strong>Status {status}:</strong> {getStatusExplainer(status)}
            </div>
          </div>
        </div>
      )}
      {status === 0 && (
        <div style={{ padding: '0 24px' }}>
          <div className="notion-callout danger" style={{ marginTop: '12px', marginBottom: '0px' }}>
            <div className="notion-callout-icon">⚠️</div>
            <div className="notion-callout-content">
              <strong>Connection Error:</strong> {statusExplainer[0]}
            </div>
          </div>
        </div>
      )}

      {/* Response tabs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => setActiveTab('body')}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === 'body' ? '600' : '400',
                color: activeTab === 'body' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'body' ? '2px solid var(--text-primary)' : '2px solid transparent',
                borderRadius: '0px',
                padding: '6px 4px'
              }}
            >
              Response Body
            </button>
            
            {jsonArray && (
              <button
                onClick={() => setActiveTab('table')}
                style={{
                  fontSize: '13px',
                  fontWeight: activeTab === 'table' ? '600' : '400',
                  color: activeTab === 'table' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'table' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  borderRadius: '0px',
                  padding: '6px 4px'
                }}
              >
                Table View
              </button>
            )}

            {isHtmlResponse && (
              <button
                onClick={() => setActiveTab('preview')}
                style={{
                  fontSize: '13px',
                  fontWeight: activeTab === 'preview' ? '600' : '400',
                  color: activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'preview' ? '2px solid var(--text-primary)' : '2px solid transparent',
                  borderRadius: '0px',
                  padding: '6px 4px'
                }}
              >
                HTML Preview
              </button>
            )}

            <button
              onClick={() => setActiveTab('headers')}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === 'headers' ? '600' : '400',
                color: activeTab === 'headers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'headers' ? '2px solid var(--text-primary)' : '2px solid transparent',
                borderRadius: '0px',
                padding: '6px 4px'
              }}
            >
              Headers ({Object.keys(headers).length})
            </button>
            <button
              onClick={() => setActiveTab('code')}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === 'code' ? '600' : '400',
                color: activeTab === 'code' ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === 'code' ? '2px solid var(--text-primary)' : '2px solid transparent',
                borderRadius: '0px',
                padding: '6px 4px'
              }}
            >
              Code Snippet
            </button>
          </div>

          {/* Context actions for active tabs */}
          {activeTab === 'body' && !isBinary && body && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {isJson && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', backgroundColor: 'var(--bg-secondary)', width: '220px' }}>
                  <Search size={12} style={{ color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Filter path (e.g. data.id)"
                    value={jsonFilter}
                    onChange={e => setJsonFilter(e.target.value)}
                    style={{
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '11px',
                      outline: 'none',
                      width: '100%',
                      padding: 0,
                      color: 'var(--text-primary)'
                    }}
                  />
                  {jsonFilter && (
                    <button 
                      onClick={() => setJsonFilter('')} 
                      style={{ border: 'none', backgroundColor: 'transparent', fontSize: '10px', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
              
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Search size={12} /> Press ⌘F to search
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setPrettyFormat(!prettyFormat)}
                  style={{
                    fontSize: '11px',
                    border: '1px solid var(--border-color)',
                    padding: '3px 8px',
                    backgroundColor: prettyFormat ? 'var(--bg-active)' : 'transparent'
                  }}
                >
                  Pretty
                </button>
                <button 
                  onClick={handleCopyBody}
                  style={{
                    fontSize: '11px',
                    border: '1px solid var(--border-color)',
                    padding: '3px 8px'
                  }}
                >
                  {copiedBody ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                  {copiedBody ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select 
                value={snippetLang} 
                onChange={(e) => setSnippetLang(e.target.value as any)}
                style={{ fontSize: '11px', padding: '2px 6px', height: '22px' }}
              >
                <option value="curl">cURL</option>
                <option value="fetch">JS Fetch</option>
                <option value="python">Python Requests</option>
              </select>
              <button 
                onClick={handleCopySnippet}
                style={{
                  fontSize: '11px',
                  border: '1px solid var(--border-color)',
                  padding: '3px 8px'
                }}
              >
                {copiedSnippet ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                {copiedSnippet ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        {/* Tab content viewer */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'body' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {typeof formattedBody === 'string' ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <CodeMirror
                    value={formattedBody}
                    readOnly={true}
                    height="100%"
                    style={{ flex: 1 }}
                    extensions={[
                      jsonLang(),
                      notionThemeExtension
                    ]}
                  />
                </div>
              ) : (
                formattedBody
              )}
            </div>
          )}

          {activeTab === 'table' && jsonArray && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden', padding: '8px' }}>
              {renderTable(jsonArray)}
            </div>
          )}

          {activeTab === 'preview' && isHtmlResponse && (
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
              <iframe 
                srcDoc={body} 
                sandbox="allow-scripts" 
                style={{
                  width: '100%',
                  height: '400px',
                  border: 'none',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          )}

          {activeTab === 'headers' && (
            <table className="notion-table">
              <thead>
                <tr>
                  <th style={{ width: '200px' }}>Header Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(headers).map(([key, val]) => (
                  <tr key={key}>
                    <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{key}</td>
                    <td style={{ fontFamily: 'Courier, monospace', fontSize: '12px' }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'code' && (
            <pre style={{
              fontFamily: 'Courier, monospace',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              padding: '12px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              maxHeight: '100%',
              overflowY: 'auto'
            }}>
              {getCodeSnippet()}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
