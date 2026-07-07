import React, { useState, useEffect } from 'react';
import { 
  History, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  PlusCircle, 
  Settings, 
  Search
} from 'lucide-react';
import { type Collection, type HistoryItem, type Environment, type RequestState, type Method } from '../types';

interface SidebarProps {
  collections: Collection[];
  history: HistoryItem[];
  environments: Environment[];
  selectedEnvId: string;
  onSelectEnvironment: (id: string) => void;
  onOpenEnvironmentModal: () => void;
  onSelectRequest: (request: RequestState, name: string, emoji?: string, notes?: string) => void;
  onCreateCollection: (name: string) => void;
  onCreateRequestInCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteRequestInCollection: (collectionId: string, requestId: string) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
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
  onSelectRequest,
  onCreateCollection,
  onCreateRequestInCollection,
  onDeleteCollection,
  onDeleteRequestInCollection,
  onClearHistory,
  onDeleteHistoryItem,
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

  useEffect(() => {
    const handleClosePickers = () => {
      setActiveEmojiPicker(null);
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
    const name = prompt('Enter request name:');
    if (name) {
      onCreateRequestInCollection(collectionId, name);
      setExpandedCollections(prev => ({ ...prev, [collectionId]: true }));
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
          <span style={{ fontWeight: '600', fontSize: '15px' }}>Izlude</span>
        </div>
        {!isTauri && onBackToLanding && (
          <button 
            onClick={onBackToLanding}
            style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)', 
              padding: '2px 6px', 
              border: '1px solid var(--border-color)', 
              borderRadius: '4px',
              backgroundColor: 'var(--bg-primary)'
            }}
          >
            ← Home
          </button>
        )}
      </div>

      {/* Environments Section */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Environment
          </span>
          <button className="notion-icon-btn" onClick={onOpenEnvironmentModal} title="Manage Environments">
            <Settings size={14} />
          </button>
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
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Collections
            </span>
            <button className="notion-icon-btn" onClick={() => setShowAddCollectionInput(!showAddCollectionInput)} title="New Collection">
              <Plus size={14} />
            </button>
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
                        <button className="notion-icon-btn" onClick={() => handleCreateRequest(col.id)} title="Add Request">
                          <PlusCircle size={12} />
                        </button>
                        <button className="notion-icon-btn" onClick={() => onDeleteCollection(col.id)} title="Delete Collection">
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
                            }} className="sidebar-subitem hover-row" onClick={() => onSelectRequest(req.requestState, req.name, req.emoji, req.notes)}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveEmojiPicker({ type: 'request', colId: col.id, reqId: req.id });
                                    setPickerCoords({ top: e.clientY + 12, left: e.clientX });
                                  }}
                                  style={{ cursor: 'pointer', fontSize: '13px', marginRight: '2px' }}
                                  title="Change Emoji"
                                >
                                  {req.emoji || '📄'}
                                </span>
                                <span className={getMethodBadgeClass(req.requestState.method)} style={{ scale: '0.85', transformOrigin: 'left center' }}>
                                  {req.requestState.method}
                                </span>
                                <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {req.name}
                                </span>
                              </div>
                              <button className="hover-actions notion-icon-btn" onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRequestInCollection(col.id, req.id);
                              }} title="Delete Request">
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
              <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                History
              </span>
            </div>
            {history.length > 0 && (
              <button style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '2px 4px' }} onClick={onClearHistory}>
                Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {history.length === 0 ? (
              <div style={{ padding: '8px 4px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No history
              </div>
            ) : (
              history.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '2px'
                }} className="sidebar-subitem hover-row" onClick={() => onSelectRequest(item.requestState, item.url)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span className={getMethodBadgeClass(item.method)} style={{ scale: '0.85', transformOrigin: 'left center' }}>
                      {item.method}
                    </span>
                    <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.url}>
                      {item.url}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', color: item.status >= 200 && item.status < 300 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {item.status || 'ERR'}
                    </span>
                    <button className="hover-actions notion-icon-btn" onClick={(e) => {
                      e.stopPropagation();
                      onDeleteHistoryItem(item.id);
                    }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 'auto',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img src="/favicon.svg" style={{ width: '14px', height: '14px' }} alt="logo" />
          <span>Izlude v0.1.0</span>
        </div>
        <button 
          onClick={onToggleTheme}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'var(--bg-primary)'
          }}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {activeEmojiPicker && (
        <div className="notion-emoji-popover" style={{ top: `${pickerCoords.top}px`, left: `${pickerCoords.left}px` }} onClick={e => e.stopPropagation()}>
          {['🔑', '💳', '📦', '👤', '⚙️', '📁', '📄', '🌐', '🚀', '🧪', '🔍', '📈', '💬', '⚠️', '✅', '❌', '⏱️', '🛠️'].map(emoji => (
            <div 
              key={emoji} 
              className="notion-emoji-btn" 
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
