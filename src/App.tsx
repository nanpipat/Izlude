import { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponsePanel } from './components/ResponsePanel';
import { EnvironmentModal } from './components/EnvironmentModal';
import { SaveRequestModal } from './components/SaveRequestModal';
import { SettingsModal } from './components/SettingsModal';
import { useDialog } from './components/Dialogs';
import { type Tab, type Collection, type HistoryItem, type Environment, type RequestState, DEFAULT_REQUEST_STATE, type ResponseState, type Method } from './types';
import { loadJSON, saveJSON } from './utils/storage';
import { Plus, X, Sun, Moon, Search, HelpCircle, Copy as CopyIcon, Pencil } from 'lucide-react';

export interface AppSettings {
  requestTimeoutMs: number;   // 0 = no timeout
  renderHtmlScripts: boolean; // opt-in for HTML preview JS
}

const DEFAULT_SETTINGS: AppSettings = { requestTimeoutMs: 0, renderHtmlScripts: false };

export default function App() {
  const dialog = useDialog();

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
  const [settings, setSettings] = useState<AppSettings>(() => loadJSON('izlude_settings', DEFAULT_SETTINGS));

  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keyboard overlays & Emoji Picker state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [openEmojiTabId, setOpenEmojiTabId] = useState<string | null>(null);
  const [emojiCoords, setEmojiCoords] = useState({ top: 0, left: 0 });
  const [tabCtxMenu, setTabCtxMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Method color helper (Feature 9)
  const getMethodColor = (m: Method): string => {
    switch (m) {
      case 'GET': return '#2ea843';
      case 'POST': return '#dfab01';
      case 'PUT': return '#0b6e99';
      case 'DELETE': return '#e03e3e';
      case 'PATCH': return '#9b51e0';
      default: return '#7a7a78';
    }
  };

  // Keyboard Shortcuts listener (Feature 12)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = () => {
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName.toLowerCase();
        return tag === 'input' || tag === 'textarea' || active.classList.contains('cm-content');
      };

      if (e.key === '?' && !isInput()) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSendRequest();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [tabs, activeTabId, environments, selectedEnvId]);

  // Close emojis + tab context menu on any global clicks
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenEmojiTabId(null);
      setTabCtxMenu(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

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

  // Initial Workspace State Loading (safe: corrupt storage won't crash the app)
  useEffect(() => {
    setCollections(loadJSON<Collection[]>('izlude_collections', []));
    setHistory(loadJSON<HistoryItem[]>('izlude_history', []));
    setEnvironments(loadJSON<Environment[]>('izlude_environments', []));
    setSelectedEnvId(loadJSON<string>('izlude_selected_env_id', 'none'));

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

  // Sync state changes with localStorage (debounced writes)
  useEffect(() => { saveJSON('izlude_collections', collections); }, [collections]);
  useEffect(() => { saveJSON('izlude_history', history); }, [history]);
  useEffect(() => { saveJSON('izlude_environments', environments); }, [environments]);
  useEffect(() => { saveJSON('izlude_selected_env_id', selectedEnvId); }, [selectedEnvId]);
  useEffect(() => { saveJSON('izlude_settings', settings); }, [settings]);

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
  const handleCreateTab = (initialState?: RequestState, name?: string, emoji?: string, notes?: string) => {
    const newTab: Tab = {
      id: Math.random().toString(36).substring(2, 9),
      name: name || 'Untitled Request',
      emoji: emoji || '📄',
      notes: notes || '',
      requestState: initialState ? JSON.parse(JSON.stringify(initialState)) : JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE)),
      responseState: null,
      isLoading: false,
      isDirty: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const performCloseTab = (id: string) => {
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

  const handleCloseTab = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = tabs.find(t => t.id === id);
    // Confirm before discarding unsaved edits
    if (target?.isDirty) {
      const ok = await dialog.confirm({
        title: 'Close tab?',
        message: `"${target.name}" has unsaved changes. Close anyway?`,
        confirmLabel: 'Close',
        danger: true,
      });
      if (!ok) return;
    }
    performCloseTab(id);
  };

  const handleRenameTab = async (id: string) => {
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;
    const newName = await dialog.prompt({
      title: 'Rename request',
      message: 'Enter a new name for this tab.',
      defaultValue: tab.name,
      placeholder: 'Request name',
      confirmLabel: 'Rename',
    });
    if (newName && newName.trim()) {
      setTabs(prev => prev.map(t => t.id === id ? { ...t, name: newName.trim(), isDirty: true } : t));
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
      const timeoutMs = settings.requestTimeoutMs;

      if (isTauri) {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const res = await tauriFetch(urlObj.toString(), {
          method,
          headers: reqHeaders,
          body: reqBody,
          connectTimeout: timeoutMs > 0 ? timeoutMs : undefined,
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
        const controller = new AbortController();
        const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
        try {
          const res = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: urlObj.toString(),
              method,
              headers: reqHeaders,
              body: reqBody
            }),
            signal: controller.signal,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Proxy request failed');

          responseStatus = data.status;
          responseStatusText = data.statusText;
          responseHeaders = data.headers;
          responseData = data.body;
        } finally {
          if (timer) clearTimeout(timer);
        }
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

      // Append to History — successes land here, failures land in catch,
      // but BOTH must record history so failed requests stay replayable.
      appendHistory({
        id: Math.random().toString(36).substring(2, 9),
        method,
        url: urlObj.toString(),
        status: responseStatus,
        statusText: responseStatusText,
        timeMs: duration,
        timestamp: Date.now(),
        requestState: JSON.parse(JSON.stringify(activeTab.requestState))
      });

    } catch (err: any) {
      console.error(err);
      const duration = Date.now() - startTime;
      const errorMessage = err?.message ? String(err.message) : 'Unknown error';
      const errorResponse: ResponseState = {
        status: 0,
        statusText: 'CORS Block / Connection Error',
        headers: {},
        body: `Error executing API request:\n\n${errorMessage}\n\nNote: If using this client in a web browser, make sure the local Node.js proxy server is running. Native desktop app bypasses CORS automatically.`,
        isBinary: false,
        timeMs: duration,
        size: 0
      };
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        responseState: errorResponse,
        isLoading: false
      } : t));

      // Failed requests are recorded too — they're the ones most worth replaying.
      appendHistory({
        id: Math.random().toString(36).substring(2, 9),
        method,
        url: urlObj.toString(),
        status: 0,
        statusText: 'Error',
        timeMs: duration,
        timestamp: Date.now(),
        requestState: JSON.parse(JSON.stringify(activeTab.requestState))
      });
    }
  };

  // Append + cap (max 50) — shared by success and failure paths.
  const appendHistory = (item: HistoryItem) => {
    setHistory(prev => [item, ...prev].slice(0, 50));
  };

  const handleSelectRequest = (savedState: RequestState, name: string, emoji?: string, notes?: string) => {
    handleCreateTab(savedState, name, emoji, notes);
  };

  const handleUpdateActiveTabNotes = (notes: string) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, notes, isDirty: true } : t));
  };

  const handleSelectEmoji = (id: string, emoji: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, emoji, isDirty: true } : t));
    setOpenEmojiTabId(null);
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

  // Create a request in a collection via a dialog (replaces the native prompt).
  const handleCreateRequestPrompt = async (collectionId: string) => {
    const name = await dialog.prompt({
      title: 'New request',
      message: 'Enter a name for the new request.',
      placeholder: 'Request name',
      defaultValue: 'New Request',
      confirmLabel: 'Create',
    });
    if (name && name.trim()) {
      handleCreateRequestInCollection(collectionId, name.trim());
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    const col = collections.find(c => c.id === collectionId);
    const ok = await dialog.confirm({
      title: 'Delete collection?',
      message: `"${col?.name || 'This collection'}" and all ${col?.requests.length || 0} request(s) inside it will be removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) setCollections(prev => prev.filter(c => c.id !== collectionId));
  };

  const handleDeleteRequestInCollection = async (collectionId: string, requestId: string) => {
    const col = collections.find(c => c.id === collectionId);
    const req = col?.requests.find(r => r.id === requestId);
    const ok = await dialog.confirm({
      title: 'Delete request?',
      message: `"${req?.name || 'This request'}" will be removed from "${col?.name || 'the collection'}".`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setCollections(prev => prev.map(col => {
      if (col.id === collectionId) {
        return { ...col, requests: col.requests.filter(r => r.id !== requestId) };
      }
      return col;
    }));
  };

  // Duplicate a saved request in place (with a " (copy)" suffix).
  const handleDuplicateRequest = (collectionId: string, requestId: string) => {
    setCollections(prev => prev.map(col => {
      if (col.id !== collectionId) return col;
      const req = col.requests.find(r => r.id === requestId);
      if (!req) return col;
      const copy: Collection['requests'][number] = {
        id: Math.random().toString(36).substring(2, 9),
        name: `${req.name} (copy)`,
        emoji: req.emoji,
        notes: req.notes,
        requestState: JSON.parse(JSON.stringify(req.requestState))
      };
      const idx = col.requests.findIndex(r => r.id === requestId);
      const requests = [...col.requests];
      requests.splice(idx + 1, 0, copy);
      return { ...col, requests };
    }));
  };

  const handleSaveToCollection = () => {
    if (!tabs.find(t => t.id === activeTabId)) return;
    if (collections.length === 0) {
      dialog.confirm({
        title: 'No collections yet',
        message: 'Create a collection in the sidebar first, then save requests into it.',
        confirmLabel: 'OK',
        cancelLabel: 'OK',
      });
      return;
    }
    setIsSaveModalOpen(true);
  };

  // Called by SaveRequestModal once a target collection + name are chosen.
  const handleSaveRequestToCollection = (collectionId: string, name: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;
    setCollections(prev => prev.map(col => {
      if (col.id !== collectionId) return col;
      return {
        ...col,
        requests: [
          ...col.requests,
          {
            id: Math.random().toString(36).substring(2, 9),
            name,
            emoji: activeTab.emoji,
            notes: activeTab.notes,
            requestState: JSON.parse(JSON.stringify(activeTab.requestState))
          }
        ]
      };
    }));
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name, isDirty: false } : t));
    setIsSaveModalOpen(false);
  };

  // ── Export / Import collections as JSON ──────────────────────
  const handleExportCollections = () => {
    const data = JSON.stringify({ type: 'izlude-collections', version: 1, exportedAt: new Date().toISOString(), collections }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `izlude-collections-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCollections = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const incoming: Collection[] = Array.isArray(parsed) ? parsed : parsed.collections;
      if (!Array.isArray(incoming)) throw new Error('File does not contain a collections array.');
      // Regenerate IDs to avoid collisions with existing collections.
      const withNewIds: Collection[] = incoming.map(c => ({
        id: Math.random().toString(36).substring(2, 9),
        name: c.name || 'Imported',
        emoji: c.emoji,
        requests: (c.requests || []).map((r: any) => ({
          id: Math.random().toString(36).substring(2, 9),
          name: r.name || 'Request',
          emoji: r.emoji,
          notes: r.notes,
          requestState: r.requestState || JSON.parse(JSON.stringify(DEFAULT_REQUEST_STATE))
        }))
      }));
      setCollections(prev => [...prev, ...withNewIds]);
    } catch (err: any) {
      await dialog.confirm({
        title: 'Import failed',
        message: err?.message || 'The file could not be read as a collections export.',
        confirmLabel: 'OK',
        cancelLabel: 'OK',
      });
    }
  };

  // LANDING PAGE RENDER
  if (currentView === 'landing') {
    return (
      <div className="landing-container">
        {/* Landing Header */}
        <header className="landing-header">
          <div className="landing-logo-container">
            <img src="/favicon.svg" className="landing-logo" alt="Izlude logo" />
            <span className="landing-logo-text">izlude</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={handleToggleTheme}
              className="outline"
              title="Toggle theme"
              style={{ padding: '7px', borderRadius: '3px' }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={() => setCurrentView('app')}
              className="primary"
              style={{
                fontFamily: 'var(--font-mono)',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                borderRadius: '3px'
              }}
            >
              Open client
            </button>
          </div>
        </header>

        {/* Hero */}
        <main className="landing-hero">
          <span className="landing-kicker">API client · instrument build</span>

          <h1 className="landing-title">
            An API client<br />built like a<br />measuring instrument.
          </h1>

          <p className="landing-desc">
            Izlude sends requests, shows the response, and otherwise stays out of the way.
            Native binary, Rust core, no CORS friction.
          </p>

          {/* CTA */}
          <div className="landing-cta-group">
            <button
              onClick={() => setCurrentView('app')}
              className="primary"
              style={{
                fontFamily: 'var(--font-mono)',
                padding: '11px 22px',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                borderRadius: '3px'
              }}
            >
              ▸ Open client
            </button>
            <a
              href="https://github.com/nanpipat/Izlude/releases"
              style={{
                fontFamily: 'var(--font-mono)',
                textDecoration: 'none',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-color)',
                padding: '2px 0'
              }}
            >
              downloads / releases ↗
            </a>
          </div>

          {/* Instrument strip — the one signature graphic */}
          <div className="landing-strip">
            <div className="landing-strip-cell">
              <span className="method-badge post">POST</span>
            </div>
            <div className="landing-strip-cell grow">
              <span>api.izlude.dev/v1/auth/login</span>
            </div>
            <div className="landing-strip-cell">
              <span className="strip-arrow">▸</span>
              <span style={{ color: 'var(--method-get)', fontWeight: 600 }}>200</span>
              <span style={{ color: 'var(--text-secondary)' }}>OK</span>
            </div>
            <div className="landing-strip-cell">
              <span className="strip-label">time</span>
              <span style={{ color: 'var(--text-primary)' }}>2.4ms</span>
            </div>
            <div className="landing-strip-cell">
              <span className="strip-label">size</span>
              <span style={{ color: 'var(--text-primary)' }}>184B</span>
            </div>
          </div>

          {/* Spec sheet — replaces the feature-card grid */}
          <div className="landing-spec">
            <div className="landing-spec-row">
              <span className="landing-spec-key">Footprint</span>
              <span className="landing-spec-val">
                About <span className="mono">5MB</span> native binary — Tauri v2 + the OS WebView. No Electron, no bundled Chromium.
              </span>
            </div>
            <div className="landing-spec-row">
              <span className="landing-spec-key">Engine</span>
              <span className="landing-spec-val">
                Requests run in Rust through <span className="mono">@tauri-apps/plugin-http</span>, so browser CORS rules don't apply.
              </span>
            </div>
            <div className="landing-spec-row">
              <span className="landing-spec-key">Editor</span>
              <span className="landing-spec-val">
                CodeMirror 6 with brace matching, folding, lint squiggles, and live line numbers in both request and response.
              </span>
            </div>
            <div className="landing-spec-row">
              <span className="landing-spec-key">Import</span>
              <span className="landing-spec-val">
                Paste a <span className="mono">curl</span> command straight into the URL bar — method, headers, params, and body fill in.
              </span>
            </div>
            <div className="landing-spec-row">
              <span className="landing-spec-key">Environments</span>
              <span className="landing-spec-val">
                Variables via <span className="mono">{`{{ }}`}</span>, with autocomplete and a resolved-value peek before you send.
              </span>
            </div>
            <div className="landing-spec-row">
              <span className="landing-spec-key">Platforms</span>
              <span className="landing-spec-val">
                macOS (Intel &amp; Apple Silicon) and Windows, compiled in CI. Web build for quick trials.
              </span>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{
          padding: '20px 40px',
          borderTop: '1px solid var(--border-color)',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginTop: 'auto',
          maxWidth: '1080px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>izlude · rust + react</span>
          <span>MIT</span>
        </footer>
      </div>
    );
  }

  // MAIN CLIENT VIEW

  const handleUpdateCollectionEmoji = (colId: string, emoji: string) => {
    setCollections(prev => prev.map(c => c.id === colId ? { ...c, emoji } : c));
  };

  const handleUpdateRequestEmoji = (colId: string, reqId: string, emoji: string) => {
    setCollections(prev => prev.map(col => {
      if (col.id === colId) {
        return {
          ...col,
          requests: col.requests.map(r => r.id === reqId ? { ...r, emoji } : r)
        };
      }
      return col;
    }));
  };



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
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSelectRequest={handleSelectRequest}
        onCreateCollection={handleCreateCollection}
        onCreateRequestInCollection={handleCreateRequestPrompt}
        onDuplicateRequest={handleDuplicateRequest}
        onDeleteCollection={handleDeleteCollection}
        onDeleteRequestInCollection={handleDeleteRequestInCollection}
        onClearHistory={() => setHistory([])}
        onDeleteHistoryItem={(id) => setHistory(prev => prev.filter(h => h.id !== id))}
        onExportCollections={handleExportCollections}
        onImportCollections={handleImportCollections}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onBackToLanding={() => setCurrentView('landing')}
        onUpdateCollectionEmoji={handleUpdateCollectionEmoji}
        onUpdateRequestEmoji={handleUpdateRequestEmoji}
      />

      {/* 2. Main Work Panel */}
      <div 
        className="main-content"
        style={{ '--method-accent': activeTab ? getMethodColor(activeTab.requestState.method) : undefined } as React.CSSProperties}
      >
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleCloseTab(tab.id, e as any);
                  }
                }}
                className={`workspace-tab hover-row ${isActive ? 'active' : ''}`}
                title={`${tab.name} — ${tab.requestState.method} ${tab.requestState.url || ''}\nDouble-click to rename · Right-click for menu`}
              >
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenEmojiTabId(tab.id);
                    setEmojiCoords({ top: e.clientY + 12, left: e.clientX - 60 });
                  }}
                  style={{ cursor: 'pointer', fontSize: '13px', marginRight: '2px' }}
                  title="Change emoji"
                  aria-label={`Change emoji for ${tab.name}`}
                >
                  {tab.emoji || '📄'}
                </span>
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  className={`icon-btn ${isActive ? '' : 'hover-actions'}`}
                  aria-label={`Close ${tab.name}`}
                  title="Close tab"
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
              notes={activeTab.notes || ''}
              onChangeNotes={handleUpdateActiveTabNotes}
            />
            <ResponsePanel
              response={activeTab.responseState}
              requestState={activeTab.requestState}
              isLoading={activeTab.isLoading}
              renderHtmlScripts={settings.renderHtmlScripts}
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

      <SaveRequestModal
        isOpen={isSaveModalOpen}
        collections={collections}
        defaultName={activeTab?.name || 'Untitled Request'}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveRequestToCollection}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={setSettings}
      />

      {/* 5. Custom Overlay modals (Features 2, 11, 12) */}
      <CommandPalette
        show={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        activeTab={activeTab}
        onUpdateActiveTabRequest={handleUpdateActiveTabRequest}
        onCreateTab={() => handleCreateTab()}
        onSaveToCollection={handleSaveToCollection}
        onToggleTheme={handleToggleTheme}
        onOpenEnvModal={() => setIsEnvModalOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearHistory={() => setHistory([])}
        onBackToLanding={() => setCurrentView('landing')}
      />

      {showShortcutsModal && (
        <div className="app-modal-overlay" onClick={() => setShowShortcutsModal(false)}>
          <div className="app-modal" style={{ width: '450px' }} onClick={e => e.stopPropagation()}>
            <div className="app-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={18} />
                <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Keyboard Shortcuts</h3>
              </div>
              <button onClick={() => setShowShortcutsModal(false)} style={{ fontSize: '18px' }}>×</button>
            </div>
            <div className="app-modal-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Send Request</span>
                  <kbd className="command-palette-shortcut">⌘ + Enter</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Open Command Palette</span>
                  <kbd className="command-palette-shortcut">⌘ + K</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Create New Tab</span>
                  <kbd className="command-palette-shortcut">⌘ + T</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Close Request Tab</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Double Click Tab or Mid-Click</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Environments Manager</span>
                  <kbd className="command-palette-shortcut">Shift + ⌘ + E</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Toggle Shortcuts Menu</span>
                  <kbd className="command-palette-shortcut">?</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab right-click context menu */}
      {tabCtxMenu && (
        <div
          className="ctx-menu"
          style={{ position: 'fixed', top: `${tabCtxMenu.y}px`, left: `${tabCtxMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="ctx-menu-item"
            onClick={() => {
              setActiveTabId(tabCtxMenu.tabId);
              handleRenameTab(tabCtxMenu.tabId);
              setTabCtxMenu(null);
            }}
          >
            <Pencil size={13} /> Rename
          </button>
          <button
            className="ctx-menu-item"
            onClick={() => {
              const t = tabs.find(x => x.id === tabCtxMenu.tabId);
              if (t) handleCreateTab(t.requestState, `${t.name} (copy)`, t.emoji, t.notes);
              setTabCtxMenu(null);
            }}
          >
            <CopyIcon size={13} /> Duplicate
          </button>
          <button
            className="ctx-menu-item danger"
            onClick={() => {
              performCloseTab(tabCtxMenu.tabId);
              setTabCtxMenu(null);
            }}
          >
            <X size={13} /> Close
          </button>
        </div>
      )}

      {openEmojiTabId && (
        <div className="emoji-popover" style={{ top: `${emojiCoords.top}px`, left: `${emojiCoords.left}px` }} onClick={e => e.stopPropagation()}>
          {['🔑', '💳', '📦', '👤', '⚙️', '📁', '📄', '🌐', '🚀', '🧪', '🔍', '📈', '💬', '⚠️', '✅', '❌', '⏱️', '🛠️'].map(emoji => (
            <div 
              key={emoji} 
              className="emoji-btn" 
              onClick={() => handleSelectEmoji(openEmojiTabId, emoji)}
            >
              {emoji}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CommandPaletteProps {
  show: boolean;
  onClose: () => void;
  activeTab: Tab | undefined;
  onUpdateActiveTabRequest: (state: RequestState) => void;
  onCreateTab: () => void;
  onSaveToCollection: () => void;
  onToggleTheme: () => void;
  onOpenEnvModal: () => void;
  onOpenSettings: () => void;
  onClearHistory: () => void;
  onBackToLanding: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
  show,
  onClose,
  activeTab,
  onUpdateActiveTabRequest,
  onCreateTab,
  onSaveToCollection,
  onToggleTheme,
  onOpenEnvModal,
  onOpenSettings,
  onClearHistory,
  onBackToLanding
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [show]);

  const commandsList = [
    { label: 'Set Method to GET', shortcut: 'G', action: () => { activeTab && onUpdateActiveTabRequest({ ...activeTab.requestState, method: 'GET' }) } },
    { label: 'Set Method to POST', shortcut: 'P', action: () => { activeTab && onUpdateActiveTabRequest({ ...activeTab.requestState, method: 'POST' }) } },
    { label: 'Set Method to PUT', shortcut: 'U', action: () => { activeTab && onUpdateActiveTabRequest({ ...activeTab.requestState, method: 'PUT' }) } },
    { label: 'Set Method to DELETE', shortcut: 'D', action: () => { activeTab && onUpdateActiveTabRequest({ ...activeTab.requestState, method: 'DELETE' }) } },
    { label: 'Set Method to PATCH', shortcut: 'H', action: () => { activeTab && onUpdateActiveTabRequest({ ...activeTab.requestState, method: 'PATCH' }) } },
    { label: 'Create New Tab', shortcut: '⌘T', action: () => onCreateTab() },
    { label: 'Save Active Request', shortcut: '⌘S', action: () => onSaveToCollection() },
    { label: 'Switch Light/Dark Theme', shortcut: 'T', action: () => onToggleTheme() },
    { label: 'Open Environment Settings', shortcut: 'Shift+⌘+E', action: () => onOpenEnvModal() },
    { label: 'Open Settings', shortcut: ',', action: () => onOpenSettings() },
    { label: 'Clear Request History', shortcut: 'L', action: () => onClearHistory() },
    { label: 'Back to Home Landing', shortcut: 'Esc', action: () => onBackToLanding() }
  ];

  const filtered = commandsList.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="command-palette-input-wrapper">
          <Search size={16} style={{ color: 'var(--text-secondary)' }} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search..." 
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedIndex(0); }}
            className="command-palette-input"
          />
        </div>
        <div className="command-palette-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No commands found
            </div>
          ) : (
            filtered.map((c, idx) => {
              const isSel = idx === selectedIndex;
              return (
                <div 
                  key={c.label} 
                  className={`command-palette-item ${isSel ? 'selected' : ''}`}
                  onClick={() => { c.action(); onClose(); }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span>{c.label}</span>
                  <span className="command-palette-shortcut">{c.shortcut}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
