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
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'code'>('body');
  const [prettyFormat, setPrettyFormat] = useState<boolean>(true);
  const [snippetLang, setSnippetLang] = useState<'curl' | 'fetch' | 'python'>('curl');
  const [copiedBody, setCopiedBody] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', flexDirection: 'column', gap: '6px' }}>
        <Terminal size={32} strokeWidth={1.5} style={{ opacity: 0.6, marginBottom: '6px' }} />
        <span style={{ fontSize: '14px', fontWeight: '500' }}>No Response yet</span>
        <span style={{ fontSize: '12px', opacity: 0.8 }}>Enter a URL and click Send to execute the request.</span>
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

    if (prettyFormat) {
      const contentType = headers['content-type'] || '';
      if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(body);
          return JSON.stringify(parsed, null, 2);
        } catch {
          return body;
        }
      }
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
              {/* Search Prompt Indicator */}
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
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              borderRadius: '4px',
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
