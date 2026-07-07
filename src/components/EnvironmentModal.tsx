import React, { useState } from 'react';
import { Plus, Trash2, Settings, Globe } from 'lucide-react';
import { type Environment, type EnvironmentVariable } from '../types';

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

  // Add environment
  const handleAddEnv = () => {
    const name = prompt('Enter environment name:');
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
  const handleDeleteEnv = (index: number) => {
    if (confirm(`Delete environment "${localEnvs[index].name}"?`)) {
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
    <div className="notion-modal-overlay">
      <div className="notion-modal" style={{ width: '700px', height: '500px' }}>
        <div className="notion-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={18} />
            <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Manage Environments</h3>
          </div>
          <button onClick={onClose} style={{ fontSize: '18px' }}>×</button>
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
              <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', paddingLeft: '8px', marginBottom: '4px' }}>
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
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{env.name}</span>
                  </div>
                  <button className="hover-actions notion-icon-btn" onClick={(e) => { e.stopPropagation(); handleDeleteEnv(index); }}>
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
                fontSize: '12px',
                padding: '6px 12px',
                justifyContent: 'center',
                color: 'var(--text-secondary)'
              }}
            >
              <Plus size={12} /> New Environment
            </button>
          </div>

          {/* Right panel: Variables table */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {currentEnv ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '500' }}>Active Name</label>
                  <input
                    type="text"
                    value={currentEnv.name}
                    onChange={(e) => {
                      const updated = localEnvs.map((env, i) => 
                        i === selectedEnvIndex ? { ...env, name: e.target.value } : env
                      );
                      setLocalEnvs(updated);
                    }}
                    style={{ fontSize: '15px', fontWeight: '600', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: '0', padding: '4px 0' }}
                  />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', marginTop: '10px' }}>
                  <table className="notion-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Variable Key</th>
                        <th>Value</th>
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
                              type="text" 
                              placeholder="Value" 
                              value={v.value} 
                              onChange={(e) => updateVariable(index, 'value', e.target.value)}
                            />
                          </td>
                          <td>
                            <button className="hover-actions notion-icon-btn" onClick={() => removeVariable(index)}>
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <button 
                    onClick={addEmptyVariable}
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '8px' }}
                  >
                    <Plus size={12} /> Add Variable
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                Select or create an environment on the left to manage variables.
              </div>
            )}
          </div>
        </div>

        <div className="notion-modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};
