import React, { useState, useEffect, useRef } from 'react';
import {
  History,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  Settings,
  Search,
  Copy,
  Download,
  Upload,
  SlidersHorizontal
} from 'lucide-react';
import { type Collection, type HistoryItem, type Environment, type RequestState, type Method } from '../types';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  environments: Environment[];
  selectedEnvId: string;
  onSelectEnvironment: (id: string) => void;
  onOpenEnvironmentModal: () => void;
  onOpenSettings: () => void;
  onSelectRequest: (request: RequestState, name: string, emoji?: string, notes?: string) => void;
  onCreateCollection: (name: string) => void;
  onCreateRequestInCollection: (collectionId: string) => void;
  onDuplicateRequest?: (collectionId: string, requestId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteRequestInCollection: (collectionId: string, requestId: string) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onExportCollections?: () => void;
  onImportCollections?: (file: File) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBackToLanding?: () => void;
  onUpdateCollectionEmoji?: (colId: string, emoji: string) => void;
  onUpdateRequestEmoji?: (colId: string, reqId: string, emoji: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collections,
  history,
  environments,
  selectedEnvId,
  onSelectEnvironment,
  onOpenEnvironmentModal,
  onOpenSettings,
  onSelectRequest,
  onCreateCollection,
  onCreateRequestInCollection,
  onDuplicateRequest,
  onDeleteCollection,
  onDeleteRequestInCollection,
  onClearHistory,
  onDeleteHistoryItem,
  onExportCollections,
  onImportCollections,
  theme,
  onToggleTheme,
  onBackToLanding,
  onUpdateCollectionEmoji,
  onUpdateRequestEmoji
}) => {
  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({});
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showAddCollectionInput, setShowAddCollectionInput] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Emoji picker popup inside sidebar (Feature 11)
  const [activeEmojiPicker, setActiveEmojiPicker] = useState<{ type: 'collection' | 'request'; colId: string; reqId?: string } | null>(null);
  const [pickerCoords, setPickerCoords] = useState({ top: 0, left: 0 });

  // Right-click context menu for saved requests
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; colId: string; reqId: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard navigation state for the history list
  const [historyCursor, setHistoryCursor] = useState<number>(-1);

  useEffect(() => {
    const handleClosePickers = () => {
      setActiveEmojiPicker(null);
      setCtxMenu(null);
    };
    document.addEventListener('click', handleClosePickers);
    return () => document.removeEventListener('click', handleClosePickers);
  }, []);

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName('');
      setShowAddCollectionInput(false);
    }
  };

  const handleCreateRequest = (collectionId: string) => {
    onCreateRequestInCollection(collectionId);
    setExpandedCollections(prev => ({ ...prev, [collectionId]: true }));
  };

  const handleImportClick = () => importInputRef.current?.click();
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportCollections) onImportCollections(file);
    e.target.value = '';
  };

  // Arrow-key navigation in the history list
  const handleHistoryKeyDown = (e: React.KeyboardEvent) => {
    if (history.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHistoryCursor(prev => Math.min(prev + 1, history.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHistoryCursor(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && historyCursor >= 0 && history[historyCursor]) {
      e.preventDefault();
      const item = history[historyCursor];
      onSelectRequest(item.requestState, item.url);
    }
  };

  const filteredCollections = collections.map(col => {
    const matchesCol = col.name.toLowerCase().includes(sidebarSearch.toLowerCase());
    const matchedReqs = col.requests.filter(req => 
      req.name.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      req.requestState.url.toLowerCase().includes(sidebarSearch.toLowerCase())
    );
    return {
      ...col,
      matched: matchesCol || matchedReqs.length > 0,
      requests: matchedReqs
    };
  }).filter(col => col.matched);

  const getMethodBadgeClass = (method: Method) => {
    return `method-badge ${method.toLowerCase()}`;
  };

  const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* App Header */}
      <div style={{
        padding: '16px 16px 12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/favicon.svg" style={{ width: '20px', height: '20px', borderRadius: '4px' }} alt="logo" />
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', letterSpacing: '-0.01em' }}>izlude</span>
        </div>
        {!isTauri && onBackToLanding && (
          <button
            onClick={onBackToLanding}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10.5px',
              color: 'var(--text-secondary)',
              padding: '2px 8px',
              border: '1px solid var(--border-color)',
              borderRadius: '2px',
              backgroundColor: 'var(--bg-primary)',
              letterSpacing: '0.04em'
            }}
          >
            ← Home
          </button>
        )}
      </div>

      {/* Environments Section */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
            Environment
          </span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <button className="icon-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings">
              <SlidersHorizontal size={13} />
            </button>
            <button className="icon-btn" onClick={onOpenEnvironmentModal} aria-label="Manage environments" title="Manage environments">
              <Settings size={14} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={selectedEnvId} 
            onChange={(e) => onSelectEnvironment(e.target.value)}
            style={{ flex: 1, fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="none">No Environment</option>
            {environments.map(env => (
              <option key={env.id} value={env.id}>{env.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main sidebar scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        
        {/* Search grid */}
        <div style={{ padding: '10px 16px 4px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 8px', backgroundColor: 'var(--bg-secondary)' }}>
            <Search size={12} style={{ color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              style={{ border: 'none', padding: '2px 0', fontSize: '12px', flex: 1, backgroundColor: 'transparent' }}
            />
            {sidebarSearch && (
              <button onClick={() => setSidebarSearch('')} style={{ padding: '2px', fontSize: '10px' }}>×</button>
            )}
          </div>
        </div>

        {/* Collections Section */}
        <div style={{ padding: '12px 16px 8px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Collections
            </span>
            <div style={{ display: 'flex', gap: '2px' }}>
              {onExportCollections && (
                <button className="icon-btn" onClick={onExportCollections} aria-label="Export collections" title="Export collections" disabled={collections.length === 0}>
                  <Download size={13} />
                </button>
              )}
              {onImportCollections && (
                <button className="icon-btn" onClick={handleImportClick} aria-label="Import collections" title="Import collections">
                  <Upload size={13} />
                </button>
              )}
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
              <button className="icon-btn" onClick={() => setShowAddCollectionInput(!showAddCollectionInput)} aria-label="New collection" title="New collection">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {showAddCollectionInput && (
            <form onSubmit={handleCreateCollection} style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
              <input 
                type="text" 
                placeholder="Collection name..." 
                value={newCollectionName} 
                onChange={(e) => setNewCollectionName(e.target.value)}
                style={{ flex: 1, fontSize: '12px', padding: '4px 6px' }}
                autoFocus
              />
              <button type="submit" className="primary" style={{ fontSize: '11px', padding: '4px 8px' }}>Save</button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            {filteredCollections.length === 0 ? (
              <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No collections
              </div>
            ) : (
              filteredCollections.map(col => {
                const isExpanded = !!expandedCollections[col.id];
                return (
                  <div key={col.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }} className="sidebar-item hover-row" onClick={() => toggleCollection(col.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveEmojiPicker({ type: 'collection', colId: col.id });
                            setPickerCoords({ top: e.clientY + 12, left: e.clientX });
                          }}
                          style={{ cursor: 'pointer', fontSize: '14px', marginRight: '2px' }}
                          title="Change Emoji"
                        >
                          {col.emoji || '📁'}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {col.name}
                        </span>
                      </div>
                      <div className="hover-actions" style={{ display: 'flex', alignItems: 'center', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => handleCreateRequest(col.id)} title="Add Request">
                          <PlusCircle size={12} />
                        </button>
                        <button className="icon-btn" onClick={() => onDeleteCollection(col.id)} title="Delete Collection">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="tree-guideline">
                        {col.requests.length === 0 ? (
                          <div style={{ padding: '4px 6px 4px 8px', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            Empty folder
                          </div>
                        ) : (
                          col.requests.map(req => (
                            <div key={req.id} style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '4px 6px 4px 8px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              marginBottom: '1px'
                            }} className="sidebar-subitem hover-row"
                              onClick={() => onSelectRequest(req.requestState, req.name, req.emoji, req.notes)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setCtxMenu({ x: e.clientX, y: e.clientY, colId: col.id, reqId: req.id });
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEmojiPicker({ type: 'request', colId: col.id, reqId: req.id });
                                    setPickerCoords({ top: e.clientY + 12, left: e.clientX });
                                  }}
                                  style={{ cursor: 'pointer', fontSize: '13px', marginRight: '2px' }}
                                  title="Change emoji"
                                  aria-label={`Change emoji for ${req.name}`}
                                >
                                  {req.emoji || '📄'}
                                </span>
                                <span className={getMethodBadgeClass(req.requestState.method)} style={{ scale: '0.85', transformOrigin: 'left center' }}>
                                  {req.requestState.method}
                                </span>
                                <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.name}>
                                  {req.name}
                                </span>
                              </div>
                              <button className="hover-actions icon-btn" onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRequestInCollection(col.id, req.id);
                              }} aria-label={`Delete ${req.name}`} title="Delete request">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* History Section */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <History size={12} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                History
              </span>
            </div>
            {history.length > 0 && (
              <button style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 4px' }} onClick={onClearHistory}>
                Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }} tabIndex={0} onKeyDown={handleHistoryKeyDown} aria-label="Request history, use arrow keys to navigate">
            {history.length === 0 ? (
              <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No history
              </div>
            ) : (
              history.map((item, idx) => {
                const isCursor = idx === historyCursor;
                return (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  backgroundColor: isCursor ? 'var(--bg-hover)' : 'transparent'
                }} className="sidebar-subitem hover-row" onClick={() => onSelectRequest(item.requestState, item.url)} onMouseEnter={() => setHistoryCursor(idx)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span className={getMethodBadgeClass(item.method)} style={{ scale: '0.85', transformOrigin: 'left center' }}>
                      {item.method}
                    </span>
                    <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.url}>
                      {item.url}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: item.status >= 200 && item.status < 300 ? 'var(--color-success)' : (item.status === 0 ? 'var(--color-danger)' : 'var(--color-warning)') }}>
                      {item.status || 'ERR'}
                    </span>
                    <button className="hover-actions icon-btn" onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
                    }} aria-label="Delete history item">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img src="/favicon.svg" style={{ width: '14px', height: '14px', borderRadius: '3px' }} alt="logo" />
          <span>izlude / v0.2.0</span>
        </div>
        <button
          onClick={onToggleTheme}
          style={{
            padding: '3px 8px',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            border: '1px solid var(--border-color)',
            borderRadius: '2px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-primary)',
            textTransform: 'uppercase'
          }}
        >
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
      </div>

      {/* Right-click context menu for saved requests */}
      {ctxMenu && (
        <div
          className="ctx-menu"
          style={{ position: 'fixed', top: `${ctxMenu.y}px`, left: `${ctxMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="ctx-menu-item"
            onClick={() => {
              onDuplicateRequest?.(ctxMenu.colId, ctxMenu.reqId);
              setCtxMenu(null);
            }}
          >
            <Copy size={13} /> Duplicate
          </button>
          <button
            className="ctx-menu-item danger"
            onClick={() => {
              onDeleteRequestInCollection(ctxMenu.colId, ctxMenu.reqId);
              setCtxMenu(null);
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {activeEmojiPicker && (
        <div className="emoji-popover" style={{ top: `${pickerCoords.top}px`, left: `${pickerCoords.left}px` }} onClick={e => e.stopPropagation()}>
          {['🔑', '💳', '📦', '👤', '⚙️', '📁', '📄', '🌐', '🚀', '🧪', '🔍', '📈', '💬', '⚠️', '✅', '❌', '⏱️', '🛠️'].map(emoji => (
            <div
              key={emoji}
              className="emoji-btn"
              onClick={() => {
                if (activeEmojiPicker.type === 'collection') {
                  onUpdateCollectionEmoji?.(activeEmojiPicker.colId, emoji);
                } else if (activeEmojiPicker.type === 'request' && activeEmojiPicker.reqId) {
                  onUpdateRequestEmoji?.(activeEmojiPicker.colId, activeEmojiPicker.reqId, emoji);
                }
                setActiveEmojiPicker(null);
              }}
            >
              {emoji}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
