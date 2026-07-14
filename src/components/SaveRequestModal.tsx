import React, { useState, useEffect, useRef } from 'react';
import { X, Search } from 'lucide-react';
import { type Collection } from '../types';

interface SaveRequestModalProps {
  isOpen: boolean;
  collections: Collection[];
  defaultName: string;
  onClose: () => void;
  onSave: (collectionId: string, name: string) => void;
}

export const SaveRequestModal: React.FC<SaveRequestModalProps> = ({
  isOpen,
  collections,
  defaultName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(defaultName);
  const [selectedId, setSelectedId] = useState<string>('');
  const [filter, setFilter] = useState('');
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setSelectedId(collections[0]?.id || '');
      setFilter('');
      const t = setTimeout(() => nameRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [isOpen, defaultName, collections]);

  if (!isOpen) return null;

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  );

  const submit = () => {
    if (!selectedId || !name.trim()) return;
    onSave(selectedId, name.trim());
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="app-modal-overlay" onClick={onClose} onKeyDown={handleKey}>
      <div className="app-modal" style={{ width: '520px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="app-modal-header">
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>Save request</h3>
          <button onClick={onClose} aria-label="Close" style={{ fontSize: '18px', lineHeight: 1 }}><X size={15} /></button>
        </div>

        <div className="app-modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Name field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Request name"
              style={{ width: '100%', fontSize: '13px', fontFamily: 'var(--font-mono)', padding: '8px 10px', backgroundColor: 'var(--bg-secondary)' }}
            />
          </div>

          {/* Collection picker with search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              Save to collection
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)', borderRadius: '3px', padding: '4px 8px', backgroundColor: 'var(--bg-secondary)' }}>
              <Search size={12} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Filter collections…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{ border: 'none', padding: '2px 0', fontSize: '12px', flex: 1, backgroundColor: 'transparent', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '3px' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '14px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No collections match.
                </div>
              ) : (
                filtered.map(c => {
                  const active = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12.5px',
                        textAlign: 'left',
                        borderTop: '1px solid transparent',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: active ? 'var(--bg-active)' : 'transparent',
                        fontWeight: active ? 600 : 400,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>{c.emoji || '📁'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{c.requests.length}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="app-modal-footer">
          <button onClick={onClose} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Cancel</button>
          <button
            className="primary"
            onClick={submit}
            disabled={!selectedId || !name.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
