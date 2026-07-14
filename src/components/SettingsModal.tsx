import React, { useState } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { type AppSettings } from '../App';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (s: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [local, setLocal] = useState<AppSettings>(settings);
  if (!isOpen) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const save = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className="app-modal-overlay" onClick={onClose} onKeyDown={handleKey}>
      <div className="app-modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="app-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={15} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>Settings</h3>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ fontSize: '18px', lineHeight: 1 }}><X size={15} /></button>
        </div>

        <div className="app-modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Request timeout */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Request timeout
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {local.requestTimeoutMs > 0 ? `${local.requestTimeoutMs} ms` : 'off'}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={60000}
              step={1000}
              value={local.requestTimeoutMs}
              onChange={(e) => setLocal(s => ({ ...s, requestTimeoutMs: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--text-primary)' }}
            />
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Abort requests that take longer than this. 0 means wait indefinitely. Slow servers will otherwise hang the Send button.
            </p>
          </div>

          {/* HTML preview scripts */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={local.renderHtmlScripts}
                onChange={(e) => setLocal(s => ({ ...s, renderHtmlScripts: e.target.checked }))}
              />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Run scripts in HTML preview
              </span>
              <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Off by default. The HTML preview renders the response body; enabling this runs its JavaScript, which is unsafe for responses from untrusted servers.
              </p>
            </div>
          </div>
        </div>

        <div className="app-modal-footer">
          <button onClick={onClose} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Cancel</button>
          <button className="primary" onClick={save} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
