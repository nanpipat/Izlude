import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Im perative dialog primitives — call from anywhere like the
   native confirm()/prompt() they replace, but rendered in-app.
     const ok = await confirm({ title, message, danger? });
     const value = await prompt({ title, message, defaultValue? });
   ───────────────────────────────────────────────────────────── */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
}

type PendingConfirm = { opts: ConfirmOptions; resolve: (v: boolean) => void };
type PendingPrompt = { opts: PromptOptions; resolve: (v: string | null) => void };

interface DialogApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within <DialogProvider>');
  return ctx;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [confirmQ, setConfirmQ] = useState<PendingConfirm | null>(null);
  const [promptQ, setPromptQ] = useState<PendingPrompt | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmQ({ opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptQ({ opts, resolve });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {confirmQ && (
        <ConfirmDialog
          opts={confirmQ.opts}
          onClose={(v) => { confirmQ.resolve(v); setConfirmQ(null); }}
        />
      )}
      {promptQ && (
        <PromptDialog
          opts={promptQ.opts}
          onClose={(v) => { promptQ.resolve(v); setPromptQ(null); }}
        />
      )}
    </DialogContext.Provider>
  );
}

/* ── ConfirmDialog ─────────────────────────────────────────── */
function ConfirmDialog({ opts, onClose }: { opts: ConfirmOptions; onClose: (v: boolean) => void }) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose(false);
    if (e.key === 'Enter') onClose(true);
  };
  return (
    <div className="app-modal-overlay" onClick={() => onClose(false)} onKeyDown={handleKey}>
      <div className="app-modal" style={{ width: '420px' }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="app-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {opts.danger && <AlertTriangle size={15} style={{ color: 'var(--color-danger)' }} />}
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>{opts.title}</h3>
          </div>
          <button onClick={() => onClose(false)} aria-label="Close" style={{ fontSize: '18px', lineHeight: 1 }}><X size={15} /></button>
        </div>
        <div className="app-modal-body" style={{ padding: '18px 20px' }}>
          {opts.message && (
            <p style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)' }}>{opts.message}</p>
          )}
        </div>
        <div className="app-modal-footer">
          <button onClick={() => onClose(false)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {opts.cancelLabel || 'Cancel'}
          </button>
          <button
            className={opts.danger ? 'danger' : 'primary'}
            onClick={() => onClose(true)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}
          >
            {opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── PromptDialog ──────────────────────────────────────────── */
function PromptDialog({ opts, onClose }: { opts: PromptOptions; onClose: (v: string | null) => void }) {
  const [value, setValue] = useState(opts.defaultValue || '');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        if ('select' in el) el.select();
      }
    }, 40);
    return () => clearTimeout(t);
  }, []);

  const submit = () => onClose(value);
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose(null);
    if (e.key === 'Enter' && !opts.multiline && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const commonStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    padding: '8px 10px',
    backgroundColor: 'var(--bg-secondary)',
    borderColor: 'var(--border-color)',
  };

  return (
    <div className="app-modal-overlay" onClick={() => onClose(null)} onKeyDown={handleKey}>
      <div className="app-modal" style={{ width: '480px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="app-modal-header">
          <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600 }}>{opts.title}</h3>
          <button onClick={() => onClose(null)} aria-label="Close" style={{ fontSize: '18px', lineHeight: 1 }}><X size={15} /></button>
        </div>
        <div className="app-modal-body" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {opts.message && (
            <p style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>{opts.message}</p>
          )}
          {opts.multiline ? (
            <textarea
              ref={(el) => { inputRef.current = el; }}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder}
              rows={4}
              style={{ ...commonStyle, resize: 'vertical' }}
              onKeyDown={handleKey}
            />
          ) : (
            <input
              ref={(el) => { inputRef.current = el; }}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={opts.placeholder}
              style={commonStyle}
              onKeyDown={handleKey}
            />
          )}
        </div>
        <div className="app-modal-footer">
          <button onClick={() => onClose(null)} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {opts.cancelLabel || 'Cancel'}
          </button>
          <button
            className="primary"
            onClick={submit}
            disabled={!value.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}
          >
            {opts.confirmLabel || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
