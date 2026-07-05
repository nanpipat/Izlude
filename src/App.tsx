import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponsePanel } from './components/ResponsePanel';
import { EnvironmentModal } from './components/EnvironmentModal';
import { type Tab, type Collection, type HistoryItem, type Environment, type RequestState, DEFAULT_REQUEST_STATE, type ResponseState } from './types';
import { Plus, X, Laptop, Terminal, Sparkles, Folder, Sun, Moon } from 'lucide-react';

export default function App() {
  // App views: 'landing' (marketing page) or 'app' (main workspace)
  const [currentView, setCurrentView] = useState<'landing' | 'app'>(() => {
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    return isTauri ? 'app' : 'landing';
  });

  // Light/Dark Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('izlude_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('none');
  
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);

  // Sync theme with HTML root class
  useEffect(() => {
    localStorage.setItem('izlude_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Initial Workspace State Loading
  useEffect(() => {
    const savedCollections = localStorage.getItem('izlude_collections');
    const savedHistory = localStorage.getItem('izlude_history');
    const savedEnvironments = localStorage.getItem('izlude_environments');
    const savedSelectedEnvId = localStorage.getItem('izlude_selected_env_id');

    if (savedCollections) setCollections(JSON.parse(savedCollections));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedEnvironments) setEnvironments(JSON.parse(savedEnvironments));
    if (savedSelectedEnvId) setSelectedEnvId(savedSelectedEnvId);

    const defaultTab: Tab = {
      id: Math.random().toString(36).substring(2, 9),
      name: 'Untitled Request',
      requestState: JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE)),
      responseState: null,
      isLoading: false,
      isDirty: false
    };
    setTabs([defaultTab]);
    setActiveTabId(defaultTab.id);
  }, []);

  // Sync state changes with localStorage
  useEffect(() => {
    if (collections.length > 0) {
      localStorage.setItem('izlude_collections', JSON.stringify(collections));
    }
  }, [collections]);

  useEffect(() => {
    localStorage.setItem('izlude_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('izlude_environments', JSON.stringify(environments));
  }, [environments]);

  useEffect(() => {
    localStorage.setItem('izlude_selected_env_id', selectedEnvId);
  }, [selectedEnvId]);

  // Helper: Replace environment variables like {{variable_name}}
  const replaceEnvVariables = (input: string): string => {
    if (!input) return '';
    if (selectedEnvId === 'none') return input;

    const activeEnv = environments.find(e => e.id === selectedEnvId);
    if (!activeEnv) return input;

    let result = input;
    activeEnv.variables.forEach(v => {
      if (v.enabled && v.key) {
        const regex = new RegExp(`{{\\s*${v.key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*}}`, 'g');
        result = result.replace(regex, v.value);
      }
    });

    return result;
  };

  // Tab Actions
  const handleCreateTab = (initialState?: RequestState, name?: string) => {
    const newTab: Tab = {
      id: Math.random().toString(36).substring(2, 9),
      name: name || 'Untitled Request',
      requestState: initialState ? JSON.parse(JSON.stringify(initialState)) : JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE)),
      responseState: null,
      isLoading: false,
      isDirty: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const tabIndex = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    
    if (newTabs.length === 0) {
      const defaultTab: Tab = {
        id: Math.random().toString(36).substring(2, 9),
        name: 'Untitled Request',
        requestState: JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE)),
        responseState: null,
        isLoading: false,
        isDirty: false
      };
      setTabs([defaultTab]);
      setActiveTabId(defaultTab.id);
      return;
    }

    setTabs(newTabs);

    if (activeTabId === id) {
      const nextActiveIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[nextActiveIndex].id);
    }
  };

  const handleRenameTab = (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const newName = prompt('Enter new request name:', tab.name);
    if (newName) {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName, isDirty: true } : t));
    }
  };

  const handleUpdateActiveTabRequest = (updatedState: RequestState) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { 
      ...t, 
      requestState: updatedState,
      isDirty: true
    } : t));
  };

  // CORS-Bypassing Native Fetch Execution
  const handleSendRequest = async () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    // Set tab loading
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: true } : t));

    const { method, url, params, headers, body, auth } = activeTab.requestState;
    const resolvedUrl = replaceEnvVariables(url);

    // Build URL parameters
    const urlObj = new URL(resolvedUrl.startsWith('http') ? resolvedUrl : `http://${resolvedUrl}`);
    params.forEach(p => {
      if (p.enabled && p.key) {
        urlObj.searchParams.append(replaceEnvVariables(p.key), replaceEnvVariables(p.value));
      }
    });

    // Build Headers
    const reqHeaders: Record<string, string> = {};
    headers.forEach(h => {
      if (h.enabled && h.key) {
        reqHeaders[replaceEnvVariables(h.key)] = replaceEnvVariables(h.value);
      }
    });

    // Injected Authentication Headers
    if (auth.type === 'bearer' && auth.state.bearer.token) {
      reqHeaders['Authorization'] = `Bearer ${replaceEnvVariables(auth.state.bearer.token)}`;
    } else if (auth.type === 'basic' && (auth.state.basic.username || auth.state.basic.password)) {
      const credentials = `${replaceEnvVariables(auth.state.basic.username)}:${replaceEnvVariables(auth.state.basic.password)}`;
      reqHeaders['Authorization'] = `Basic ${btoa(credentials)}`;
    } else if (auth.type === 'apikey' && auth.state.apiKey.key) {
      const resolvedKey = replaceEnvVariables(auth.state.apiKey.key);
      const resolvedVal = replaceEnvVariables(auth.state.apiKey.value);
      if (auth.state.apiKey.addTo === 'headers') {
        reqHeaders[resolvedKey] = resolvedVal;
      } else {
        urlObj.searchParams.append(resolvedKey, resolvedVal);
      }
    }

    // Build Body payload
    let reqBody: any = null;
    if (method !== 'GET' && method !== 'HEAD') {
      if (body.type === 'raw') {
        reqBody = replaceEnvVariables(body.rawContent);
        if (body.rawType === 'json') {
          reqHeaders['Content-Type'] = 'application/json';
        } else if (body.rawType === 'html') {
          reqHeaders['Content-Type'] = 'text/html';
        } else if (body.rawType === 'xml') {
          reqHeaders['Content-Type'] = 'application/xml';
        } else {
          reqHeaders['Content-Type'] = 'text/plain';
        }
      } else if (body.type === 'x-www-form-urlencoded') {
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        const search = new URLSearchParams();
        body.urlencoded.forEach(item => {
          if (item.enabled && item.key) {
            search.append(replaceEnvVariables(item.key), replaceEnvVariables(item.value));
          }
        });
        reqBody = search.toString();
      } else if (body.type === 'form-data') {
        reqHeaders['Content-Type'] = 'application/json'; // Tauri plugin handles JSON maps easily
        const map: Record<string, string> = {};
        body.formData.forEach(item => {
          if (item.enabled && item.key) {
            map[replaceEnvVariables(item.key)] = replaceEnvVariables(item.value);
          }
        });
        reqBody = JSON.stringify(map);
      }
    }

    const startTime = Date.now();

    try {
      let responseData: any;
      let responseHeaders: Record<string, string> = {};
      let responseStatus = 0;
      let responseStatusText = '';

      // Check for Tauri native env
      const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

      if (isTauri) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const res = await tauriFetch(urlObj.toString(), {
          method,
          headers: reqHeaders,
          body: reqBody
        });

        responseStatus = res.status;
        responseStatusText = res.statusText || (res.status === 200 ? 'OK' : 'Response Status');
        
        // Extract Headers from Headers Map
        res.headers.forEach((val, key) => {
          responseHeaders[key] = val;
        });

        responseData = await res.text();
      } else {
        // Fallback to Vercel/Node Proxy server for standard web browsers
        const proxyUrl = 'http://localhost:3001/api/proxy';
        const res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlObj.toString(),
            method,
            headers: reqHeaders,
            body: reqBody
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Proxy request failed');

        responseStatus = data.status;
        responseStatusText = data.statusText;
        responseHeaders = data.headers;
        responseData = data.body;
      }

      const duration = Date.now() - startTime;
      const size = new Blob([responseData]).size;

      const finalResponseState: ResponseState = {
        status: responseStatus,
        statusText: responseStatusText,
        headers: responseHeaders,
        body: responseData,
        isBinary: false,
        timeMs: duration,
        size: size
      };

      // Update tabs state
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        responseState: finalResponseState,
        isLoading: false
      } : t));

      // Append to History
      const newHistoryItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        method,
        url: urlObj.toString(),
        status: responseStatus,
        statusText: responseStatusText,
        timeMs: duration,
        timestamp: Date.now(),
        requestState: JSON.parse(JSON.stringify(activeTab.requestState))
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 50)); // Cap history list to 50 items

    } catch (err: any) {
      console.error(err);
      const duration = Date.now() - startTime;
      const errorResponse: ResponseState = {
        status: 0,
        statusText: 'CORS Block / Connection Error',
        headers: {},
        body: `Error executing API request:\n\n${err.message}\n\nNote: If using this client in a web browser, make sure the local Node.js proxy server is running. Native desktop app bypasses CORS automatically.`,
        isBinary: false,
        timeMs: duration,
        size: 0
      };
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        responseState: errorResponse,
        isLoading: false
      } : t));
    }
  };

  const handleSelectRequest = (savedState: RequestState, name: string) => {
    handleCreateTab(savedState, name);
  };

  const handleCreateCollection = (name: string) => {
    const newCol: Collection = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      requests: []
    };
    setCollections(prev => [...prev, newCol]);
  };

  const handleCreateRequestInCollection = (collectionId: string, requestName: string) => {
    setCollections(prev => prev.map(col => {
      if (col.id === collectionId) {
        return {
          ...col,
          requests: [
            ...col.requests,
            {
              id: Math.random().toString(36).substring(2, 9),
              name: requestName,
              requestState: JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE))
            }
          ]
        };
      }
      return col;
    }));
  };

  const handleDeleteCollection = (collectionId: string) => {
    if (confirm('Delete this collection and all requests inside it?')) {
      setCollections(prev => prev.filter(c => c.id !== collectionId));
    }
  };

  const handleDeleteRequestInCollection = (collectionId: string, requestId: string) => {
    setCollections(prev => prev.map(col => {
      if (col.id === collectionId) {
        return {
          ...col,
          requests: col.requests.filter(r => r.id !== requestId)
        };
      }
      return col;
    }));
  };

  const handleSaveToCollection = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    if (collections.length === 0) {
      alert('Create a collection in the sidebar first to save requests!');
      return;
    }

    const colNames = collections.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
    const selection = prompt(`Enter collection number to save this request to:\n\n${colNames}`);
    
    if (selection) {
      const idx = parseInt(selection) - 1;
      const targetCol = collections[idx];
      if (targetCol) {
        const reqName = prompt('Enter request name:', activeTab.name);
        if (reqName) {
          setCollections(prev => prev.map((col, i) => {
            if (i === idx) {
              return {
                ...col,
                requests: [
                  ...col.requests,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    name: reqName,
                    requestState: JSON.parse(JSON.stringify(activeTab.requestState))
                  }
                ]
              };
            }
            return col;
          }));
          
          setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name: reqName, isDirty: false } : t));
          alert(`Saved successfully to ${targetCol.name}!`);
        }
      } else {
        alert('Invalid collection number selected.');
      }
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  // LANDING PAGE RENDER
  if (currentView === 'landing') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflowY: 'auto'
      }}>
        {/* Landing Header */}
        <header style={{
          padding: '20px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/favicon.svg" style={{ width: '28px', height: '28px', borderRadius: '6px' }} alt="Izlude logo" />
            <span style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.3px' }}>Izlude</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={handleToggleTheme}
              style={{
                padding: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px'
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button 
              onClick={() => setCurrentView('app')}
              className="primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500'
              }}
            >
              Launch Client
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <main style={{
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          padding: '60px 40px 100px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-secondary)',
            padding: '4px 10px',
            borderRadius: '4px',
            marginBottom: '16px',
            border: '1px solid var(--border-color)'
          }}>
            v0.0.1 Beta Release
          </span>

          <h1 style={{
            fontSize: '44px',
            fontWeight: '800',
            letterSpacing: '-1.5px',
            lineHeight: '1.15',
            maxWidth: '750px',
            marginBottom: '16px'
          }}>
            The Native, Ultra-Lightweight API Client
          </h1>

          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
            maxWidth: '650px',
            lineHeight: '1.6',
            marginBottom: '32px'
          }}>
            Ditch the memory-heavy Electron clients. Izlude compiles down to a native 5MB bundle, using native OS WebViews and a fast Rust backend to bypass browser CORS limitations natively. Styled cleanly in signature Notion monochrome.
          </p>

          {/* CTA Group */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '48px' }}>
            <button 
              onClick={() => setCurrentView('app')}
              className="primary"
              style={{ padding: '12px 28px', fontSize: '15px', fontWeight: '500' }}
            >
              Launch Web Client
            </button>
            <a 
              href="https://github.com/nanpipat/Izlude/releases/download/v0.0.1/Izlude_0.1.0_aarch64.dmg"
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Laptop size={16} /> Download macOS (.dmg)
            </a>
            <a 
              href="https://github.com/nanpipat/Izlude/releases"
              style={{
                textDecoration: 'none',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '500',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Terminal size={16} /> Download Windows (.exe)
            </a>
          </div>

          {/* Vector GUI App Mockup */}
          <div style={{
            width: '100%',
            maxWidth: '850px',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            boxShadow: '0 12px 32px rgba(15, 15, 15, 0.08)',
            overflow: 'hidden',
            marginBottom: '80px',
            aspectRatio: '1.6'
          }}>
            <svg viewBox="0 0 800 500" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              {/* Header block */}
              <rect x="0" y="0" width="800" height="40" fill="#f7f7f5" />
              <circle cx="20" cy="20" r="5" fill="#ff5f56" />
              <circle cx="36" cy="20" r="5" fill="#ffbd2e" />
              <circle cx="52" cy="20" r="5" fill="#27c93f" />
              <text x="400" y="25" fill="#7a7a78" font-family="monospace" font-size="12" text-anchor="middle">Izlude - API Client</text>
              <line x1="0" y1="40" x2="800" y2="40" stroke="#e9e9e6" stroke-width="1" />

              {/* Sidebar */}
              <rect x="0" y="40" width="200" height="460" fill="#ffffff" />
              <line x1="200" y1="40" x2="200" y2="500" stroke="#e9e9e6" stroke-width="1" />
              
              {/* Sidebar items */}
              <rect x="15" y="60" width="170" height="24" rx="4" fill="#efefe9" />
              <text x="25" y="76" font-family="sans-serif" font-weight="bold" font-size="12" fill="#37352f">collections</text>
              <text x="35" y="112" font-family="sans-serif" font-size="12" fill="#37352f">📁 User Auth API</text>
              <text x="35" y="138" font-family="sans-serif" font-size="12" fill="#37352f">📁 Payments Gateway</text>
              
              <text x="25" y="180" font-family="sans-serif" font-weight="bold" font-size="11" fill="#7a7a78">HISTORY</text>
              <rect x="25" y="196" width="30" height="15" rx="3" fill="#2ea843" />
              <text x="40" y="207" font-family="sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">POST</text>
              <text x="62" y="207" font-family="sans-serif" font-size="11" fill="#37352f">/api/v1/auth/login</text>

              <rect x="25" y="222" width="30" height="15" rx="3" fill="#2ea843" />
              <text x="40" y="233" font-family="sans-serif" font-size="9" font-weight="bold" fill="#ffffff" text-anchor="middle">GET</text>
              <text x="62" y="233" font-family="sans-serif" font-size="11" fill="#37352f">/users/me</text>

              {/* Main Client workspace */}
              <rect x="200" y="40" width="600" height="460" fill="#ffffff" />
              
              {/* Method select / URL bar */}
              <rect x="220" y="65" width="70" height="30" rx="4" fill="#f7f7f5" stroke="#e9e9e6" />
              <text x="255" y="84" font-family="sans-serif" font-weight="bold" font-size="12" fill="#2ea843" text-anchor="middle">POST</text>
              
              <rect x="298" y="65" width="410" height="30" rx="4" fill="#f7f7f5" stroke="#e9e9e6" />
              <text x="312" y="84" font-family="monospace" font-size="12" fill="#37352f">https://api.izlude.dev/v1/auth/login</text>
              
              <rect x="716" y="65" width="62" height="30" rx="4" fill="#37352f" />
              <text x="747" y="84" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">Send</text>

              {/* Tabs list */}
              <text x="220" y="130" font-family="sans-serif" font-weight="bold" font-size="12" fill="#37352f">Params</text>
              <text x="280" y="130" font-family="sans-serif" font-size="12" fill="#7a7a78">Headers</text>
              <text x="350" y="130" font-family="sans-serif" font-size="12" fill="#7a7a78">Body (JSON)</text>
              <line x1="220" y1="138" x2="260" y2="138" stroke="#37352f" stroke-width="2" />
              <line x1="220" y1="140" x2="780" y2="140" stroke="#e9e9e6" stroke-width="1" />

              {/* Grid block */}
              <rect x="220" y="155" width="560" height="24" fill="#f7f7f5" />
              <text x="230" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="#7a7a78">Key</text>
              <text x="400" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="#7a7a78">Value</text>
              <text x="580" y="171" font-family="sans-serif" font-size="11" font-weight="bold" fill="#7a7a78">Description</text>
              
              <line x1="220" y1="205" x2="780" y2="205" stroke="#e9e9e6" stroke-width="1" />
              <text x="230" y="196" font-family="monospace" font-size="12" fill="#37352f">grant_type</text>
              <text x="400" y="196" font-family="monospace" font-size="12" fill="#0f7b2c">"password"</text>
              
              {/* Response block divider */}
              <line x1="200" y1="230" x2="800" y2="230" stroke="#e9e9e6" stroke-width="2" />
              
              {/* Response Panel */}
              <rect x="200" y="232" width="600" height="268" fill="#f7f7f5" />
              
              <text x="220" y="260" font-family="sans-serif" font-weight="bold" font-size="12" fill="#7a7a78">Response</text>
              <rect x="715" y="248" width="62" height="18" rx="3" fill="#e2f5e6" />
              <text x="746" y="261" font-family="sans-serif" font-size="10" font-weight="bold" fill="#2ea843" text-anchor="middle">200 OK</text>
              <line x1="200" y1="275" x2="800" y2="275" stroke="#e9e9e6" stroke-width="1" />

              {/* CodeMirror Mock Editor in Response Panel */}
              <rect x="220" y="290" width="560" height="190" rx="4" fill="#ffffff" stroke="#e9e9e6" />
              
              {/* Line numbers */}
              <rect x="220" y="290" width="30" height="190" fill="#f7f7f5" />
              <line x1="250" y1="290" x2="250" y2="480" stroke="#e9e9e6" stroke-width="1" />
              <text x="238" y="312" font-family="monospace" font-size="11" fill="#7a7a78" text-anchor="end">1</text>
              <text x="238" y="332" font-family="monospace" font-size="11" fill="#7a7a78" text-anchor="end">2</text>
              <text x="238" y="352" font-family="monospace" font-size="11" fill="#7a7a78" text-anchor="end">3</text>
              <text x="238" y="372" font-family="monospace" font-size="11" fill="#7a7a78" text-anchor="end">4</text>
              
              {/* Highlighted JSON content */}
              <text x="262" y="312" font-family="monospace" font-size="12" fill="#37352f" font-weight="bold">{"{"}</text>
              <text x="282" y="332" font-family="monospace" font-size="12" fill="#9a3b1a" font-weight="bold">"status"</text>
              <text x="350" y="332" font-family="monospace" font-size="12" fill="#37352f">:</text>
              <text x="362" y="332" font-family="monospace" font-size="12" fill="#0f7b2c">"success"</text>
              <text x="430" y="332" font-family="monospace" font-size="12" fill="#37352f">,</text>

              <text x="282" y="352" font-family="monospace" font-size="12" fill="#9a3b1a" font-weight="bold">"access_token"</text>
              <text x="400" y="352" font-family="monospace" font-size="12" fill="#37352f">:</text>
              <text x="412" y="352" font-family="monospace" font-size="12" fill="#0f7b2c">"eyJhbGciOiJIUzI1NiIsIn..."</text>
              <text x="600" y="352" font-family="monospace" font-size="12" fill="#37352f">,</text>

              <text x="282" y="372" font-family="monospace" font-size="12" fill="#9a3b1a" font-weight="bold">"expires_in"</text>
              <text x="380" y="372" font-family="monospace" font-size="12" fill="#37352f">:</text>
              <text x="392" y="372" font-family="monospace" font-size="12" fill="#0b6e99">3600</text>
              
              <text x="262" y="392" font-family="monospace" font-size="12" fill="#37352f" font-weight="bold">{"}"}</text>
            </svg>
          </div>

          {/* Key Value Grid Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            width: '100%',
            maxWidth: '900px',
            textAlign: 'left'
          }}>
            <div style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={16} style={{ color: 'var(--color-success)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Direct CORS Bypassing</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Tauri executes requests natively in Rust. Skip local proxy setups or browser extensions; bypass CORS constraints automatically.
              </p>
            </div>

            <div style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Terminal size={16} style={{ color: 'var(--color-info)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>CodeMirror 6 Editor</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Full bracket closing, JSON code folding, syntax check underlines, and responsive line numbering directly in request and response panels.
              </p>
            </div>

            <div style={{ padding: '24px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Folder size={16} style={{ color: 'var(--color-warning)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Direct cURL Pastes</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Paste cURL commands directly in the URL input bar. Automatically decomposes and populates method, headers, params, and body data.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          padding: '24px',
          borderTop: '1px solid var(--border-color)',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginTop: 'auto'
        }}>
          Izlude API Client • Made with Rust & React. Released under MIT.
        </footer>
      </div>
    );
  }

  // MAIN CLIENT VIEW
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* 1. Workspace Sidebar */}
      <Sidebar
        collections={collections}
        history={history}
        environments={environments}
        selectedEnvId={selectedEnvId}
        onSelectEnvironment={setSelectedEnvId}
        onOpenEnvironmentModal={() => setIsEnvModalOpen(true)}
        onSelectRequest={handleSelectRequest}
        onCreateCollection={handleCreateCollection}
        onCreateRequestInCollection={handleCreateRequestInCollection}
        onDeleteCollection={handleDeleteCollection}
        onDeleteRequestInCollection={handleDeleteRequestInCollection}
        onClearHistory={() => setHistory([])}
        onDeleteHistoryItem={(id) => setHistory(prev => prev.filter(h => h.id !== id))}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onBackToLanding={() => setCurrentView('landing')}
      />

      {/* 2. Main Work Panel */}
      <div className="main-content">
        {/* Workspace Tab bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          height: '40px',
          padding: '0 8px',
          overflowX: 'auto',
          userSelect: 'none'
        }}>
          {tabs.map(tab => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                onDoubleClick={() => handleRenameTab(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleCloseTab(tab.id, e as any);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  height: '32px',
                  borderRadius: '4px 4px 0 0',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid var(--bg-primary)' : '1px solid transparent',
                  backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '500' : '400',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  marginTop: '8px',
                  marginRight: '2px',
                  minWidth: '100px',
                  maxWidth: '180px',
                  position: 'relative',
                  zIndex: isActive ? 2 : 1
                }}
              >
                <span className={`method-badge ${tab.requestState.method.toLowerCase()}`} style={{ scale: '0.8', margin: '0 -4px' }}>
                  {tab.requestState.method}
                </span>
                <span style={{ 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis', 
                  whiteSpace: 'nowrap',
                  flex: 1
                }}>
                  {tab.name}
                  {tab.isDirty && ' *'}
                </span>
                <button 
                  onClick={(e) => handleCloseTab(tab.id, e)}
                  style={{
                    padding: '2px',
                    borderRadius: '50%',
                    opacity: 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className="notion-icon-btn"
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}
          
          <button 
            onClick={() => handleCreateTab()}
            style={{
              padding: '6px',
              borderRadius: '4px',
              marginLeft: '6px',
              color: 'var(--text-secondary)'
            }}
          >
            <Plus size={14} />
          </button>

          {activeTab && (
            <button 
              onClick={handleSaveToCollection}
              style={{
                fontSize: '11px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                padding: '4px 8px',
                marginLeft: 'auto',
                height: '24px'
              }}
            >
              Save Request
            </button>
          )}
        </div>

        {/* 3. Panel components */}
        {activeTab ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <RequestBuilder
              requestState={activeTab.requestState}
              onChangeRequestState={handleUpdateActiveTabRequest}
              onSend={handleSendRequest}
              isLoading={activeTab.isLoading}
              activeVariables={environments.find(e => e.id === selectedEnvId)?.variables || []}
            />
            <ResponsePanel
              response={activeTab.responseState}
              requestState={activeTab.requestState}
              isLoading={activeTab.isLoading}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Open a request tab to begin.
          </div>
        )}
      </div>

      {/* 4. Global Settings modals */}
      <EnvironmentModal
        environments={environments}
        isOpen={isEnvModalOpen}
        onClose={() => setIsEnvModalOpen(false)}
        onSaveEnvironments={setEnvironments}
      />
    </div>
  );
}
