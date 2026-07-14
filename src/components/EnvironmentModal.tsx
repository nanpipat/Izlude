import React, { useState } from 'react';
import { Plus, Trash2, Settings, Globe } from 'lucide-react';
import { type Environment, type EnvironmentVariable } from '../types';
import { useDialog } from './Dialogs';

interface EnvironmentModalProps {
  environments: Environment[];
  isOpen: boolean;
  onClose: () => void;
  onSaveEnvironments: (envs: Environment[]) => void;
}

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  environments,
  isOpen,
  onClose,
  onSaveEnvironments
}) => {
  const [localEnvs, setLocalEnvs] = useState<Environment[]>(() => 
    JSON.parse(JSON.stringify(environments))
  );
  const [selectedEnvIndex, setSelectedEnvIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentEnv = localEnvs[selectedEnvIndex];

  const dialog = useDialog();

  // Add environment
  const handleAddEnv = async () => {
    const name = await dialog.prompt({
      title: 'New environment',
      message: 'Enter a name for the new environment.',
      placeholder: 'e.g. Production',
      defaultValue: 'New Environment',
      confirmLabel: 'Create',
    });
    if (name && name.trim()) {
      const newEnv: Environment = {
        id: Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        variables: [{ id: '1', key: '', value: '', enabled: true }]
      };
      const updated = [...localEnvs, newEnv];
      setLocalEnvs(updated);
      setSelectedEnvIndex(updated.length - 1);
    }
  };

  // Delete environment
  const handleDeleteEnv = async (index: number) => {
    const ok = await dialog.confirm({
      title: 'Delete environment?',
      message: `"${localEnvs[index].name}" and all its variables will be removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) {
      const updated = localEnvs.filter((_, i) => i !== index);
      setLocalEnvs(updated);
      setSelectedEnvIndex(Math.max(0, index - 1));
    }
  };

  // Update variable row
  const updateVariable = (varIndex: number, field: keyof EnvironmentVariable, value: any) => {
    if (!currentEnv) return;

    const updatedVars = [...currentEnv.variables];
    updatedVars[varIndex] = {
      ...updatedVars[varIndex],
      [field]: value
    };

    // If typing in the last empty row, append a new empty row
    const lastVar = updatedVars[updatedVars.length - 1];
    if (lastVar && (lastVar.key || lastVar.value) && varIndex === updatedVars.length - 1) {
      updatedVars.push({
        id: Math.random().toString(36).substring(2, 9),
        key: '',
        value: '',
        enabled: true
      });
    }

    const updatedEnvs = localEnvs.map((env, i) => 
      i === selectedEnvIndex ? { ...env, variables: updatedVars } : env
    );
    setLocalEnvs(updatedEnvs);
  };

  // Delete variable row
  const removeVariable = (varIndex: number) => {
    if (!currentEnv) return;

    let updatedVars = currentEnv.variables.filter((_, i) => i !== varIndex);
    if (updatedVars.length === 0) {
      updatedVars = [{ id: '1', key: '', value: '', enabled: true }];
    }

    const updatedEnvs = localEnvs.map((env, i) => 
      i === selectedEnvIndex ? { ...env, variables: updatedVars } : env
    );
    setLocalEnvs(updatedEnvs);
  };

  // Add empty row
  const addEmptyVariable = () => {
    if (!currentEnv) return;

    const newVar = {
      id: Math.random().toString(36).substring(2, 9),
      key: '',
      value: '',
      enabled: true
    };

    const updatedEnvs = localEnvs.map((env, i) => 
      i === selectedEnvIndex ? { ...env, variables: [...env.variables, newVar] } : env
    );
    setLocalEnvs(updatedEnvs);
  };

  const handleSave = () => {
    // Clean up empty rows before saving
    const cleaned = localEnvs.map(env => ({
      ...env,
      variables: env.variables.filter(v => v.key || v.value)
    }));
    onSaveEnvironments(cleaned);
    onClose();
  };

  return (
    <div className="app-modal-overlay">
      <div className="app-modal" style={{ width: '700px', height: '500px' }}>
        <div className="app-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>Environments</h3>
          </div>
          <button onClick={onClose} style={{ fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left panel: Environment list */}
          <div style={{
            width: '200px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '12px 8px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em', paddingLeft: '8px', marginBottom: '4px' }}>
                Environments
              </span>
              
              {localEnvs.map((env, index) => (
                <div
                  key={env.id}
                  onClick={() => setSelectedEnvIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    backgroundColor: selectedEnvIndex === index ? 'var(--bg-active)' : 'transparent',
                    fontWeight: selectedEnvIndex === index ? '500' : '400'
                  }}
                  className="sidebar-item hover-row"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                  </div>
                  <button className="hover-actions icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteEnv(index); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddEnv}
              style={{
                width: '100%',
                border: '1px dashed var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                padding: '6px 12px',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                letterSpacing: '0.04em'
              }}
            >
              <Plus size={12} /> New environment
            </button>
          </div>

          {/* Right panel: Variables table */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {currentEnv ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div className="callout info" style={{ margin: 0, fontSize: '11.5px' }}>
                  <div className="callout-icon"><Globe size={13} style={{ color: 'var(--text-secondary)' }} /></div>
                  <div className="callout-content">
                    Values are stored in localStorage on this device. Mark secrets to mask them — they're hidden in the value peek and stored, but you should treat localStorage as plaintext.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 500 }}>Name</label>
                  <input
                    type="text"
                    value={currentEnv.name}
                    onChange={(e) => {
                      const updated = localEnvs.map((env, i) =>
                        i === selectedEnvIndex ? { ...env, name: e.target.value } : env
                      );
                      setLocalEnvs(updated);
                    }}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 600, border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: '0', padding: '4px 0' }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
                  <table className="kv-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Variable Key</th>
                        <th>Value</th>
                        <th style={{ width: '56px' }} title="Mark as secret — hidden in value peek, masked on export">Secret</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentEnv.variables.map((v, index) => (
                        <tr key={v.id} className="hover-row">
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={v.enabled}
                              onChange={(e) => updateVariable(index, 'enabled', e.target.checked)}
                              aria-label="enabled"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              placeholder="VARIABLE_NAME"
                              value={v.key}
                              onChange={(e) => updateVariable(index, 'key', e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type={v.secret ? 'password' : 'text'}
                              placeholder="Value"
                              value={v.value}
                              onChange={(e) => updateVariable(index, 'value', e.target.value)}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!v.secret}
                              onChange={(e) => updateVariable(index, 'secret', e.target.checked)}
                              title="Mark as secret — masked on export"
                              aria-label="secret"
                            />
                          </td>
                          <td>
                            <button className="hover-actions icon-btn" onClick={() => removeVariable(index)} aria-label="Delete variable">
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <button
                    onClick={addEmptyVariable}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '8px' }}
                  >
                    <Plus size={12} /> Add variable
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                Select or create an environment on the left.
              </div>
            )}
          </div>
        </div>

        <div className="app-modal-footer">
          <button onClick={onClose} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Cancel</button>
          <button className="primary" onClick={handleSave} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', letterSpacing: '0.04em' }}>Save changes</button>
        </div>
      </div>
    </div>
  );
};
