import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Copy, Check, Sparkles, Terminal, ChevronDown, ChevronRight } from 'lucide-react';
import { type RequestState, type Method, type KeyValuePair, type AuthType, type BodyType, type RawBodyType, type AuthState } from '../types';
import { parseCurl, generateCurl } from '../utils/curlParser';
import CodeMirror from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { notionThemeExtension } from '../utils/codemirrorTheme';

interface RequestBuilderProps {
  requestState: RequestState;
  onChangeRequestState: (state: RequestState) => void;
  onSend: () => void;
  isLoading: boolean;
  activeVariables: { key: string; value: string; enabled: boolean }[];
}

const COMMON_HEADERS = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Length',
  'Content-Type',
  'Cookie',
  'Host',
  'Origin',
  'Referer',
  'User-Agent'
];

const COMMON_HEADER_VALUES: Record<string, string[]> = {
  'Content-Type': [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/html',
    'text/plain',
    'application/xml'
  ],
  'Accept': [
    'application/json',
    '*/*',
    'text/html',
    'application/xhtml+xml'
  ],
  'Cache-Control': [
    'no-cache',
    'no-store',
    'max-age=0'
  ],
  'Connection': [
    'keep-alive',
    'close'
  ]
};

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  requestState,
  onChangeRequestState,
  onSend,
  isLoading,
  activeVariables
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params');
  const [showCurlModal, setShowCurlModal] = useState(false);
  const [curlInput, setCurlInput] = useState('');
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCalculatedHeaders, setShowCalculatedHeaders] = useState(false);

  // Suggestions popover state
  const [suggestState, setSuggestState] = useState<{
    visible: boolean;
    type: 'variable' | 'headerKey' | 'headerValue';
    items: string[];
    index: number;
    fieldId: string; // e.g. 'url', 'param-key-2', 'header-val-1'
    filterText: string;
    coords: { top: number; left: number };
  }>({
    visible: false,
    type: 'variable',
    items: [],
    index: 0,
    fieldId: '',
    filterText: '',
    coords: { top: 0, left: 0 }
  });

  const activeInputRef = useRef<HTMLInputElement | null>(null);

  const { method, url, params, headers, body, auth } = requestState;

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 2500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeRequestState({
      ...requestState,
      method: e.target.value as Method
    });
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    if (val.trim().toLowerCase().startsWith('curl ')) {
      try {
        const parsed = parseCurl(val);
        onChangeRequestState(parsed);
        setToastMessage("Imported cURL command details successfully!");
        return;
      } catch (err: any) {
        setToastMessage("Failed to parse cURL: " + err.message);
      }
    }

    onChangeRequestState({
      ...requestState,
      url: val
    });

    handleInputAutocomplete(e.target, 'url', val);
  };

  const handleInputAutocomplete = (
    input: HTMLInputElement, 
    fieldId: string, 
    value: string
  ) => {
    activeInputRef.current = input;
    const cursorPos = input.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
    const lastCloseBrace = textBeforeCursor.lastIndexOf('}}');
    
    if (lastOpenBrace > -1 && lastOpenBrace > lastCloseBrace) {
      const filterText = textBeforeCursor.slice(lastOpenBrace + 2);
      const filteredVars = activeVariables
        .map(v => v.key)
        .filter(k => k.toLowerCase().includes(filterText.toLowerCase()));

      if (filteredVars.length > 0) {
        const rect = input.getBoundingClientRect();
        setSuggestState({
          visible: true,
          type: 'variable',
          items: filteredVars,
          index: 0,
          fieldId,
          filterText,
          coords: {
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX
          }
        });
        return;
      }
    }

    if (fieldId.startsWith('header-key-')) {
      const filteredKeys = COMMON_HEADERS.filter(h => 
        h.toLowerCase().includes(value.toLowerCase())
      );
      if (filteredKeys.length > 0) {
        const rect = input.getBoundingClientRect();
        setSuggestState({
          visible: true,
          type: 'headerKey',
          items: filteredKeys,
          index: 0,
          fieldId,
          filterText: value,
          coords: {
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX
          }
        });
        return;
      }
    } else if (fieldId.startsWith('header-val-')) {
      const idx = parseInt(fieldId.split('-')[2]);
      const headerRow = headers[idx];
      const headerKey = headerRow ? headerRow.key : '';
      const commonVals = COMMON_HEADER_VALUES[headerKey] || [];
      const filteredVals = commonVals.filter(v => 
        v.toLowerCase().includes(value.toLowerCase())
      );
      
      if (filteredVals.length > 0) {
        const rect = input.getBoundingClientRect();
        setSuggestState({
          visible: true,
          type: 'headerValue',
          items: filteredVals,
          index: 0,
          fieldId,
          filterText: value,
          coords: {
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX
          }
        });
        return;
      }
    }

    setSuggestState(prev => ({ ...prev, visible: false }));
  };

  const handleSuggestionSelect = (selectedText: string) => {
    const input = activeInputRef.current;
    if (!input) return;

    const currentVal = input.value;
    const cursorPos = input.selectionStart || 0;
    let newValue = '';
    let newCursorPos = 0;

    if (suggestState.type === 'variable') {
      const textBeforeCursor = currentVal.slice(0, cursorPos);
      const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
      const replacement = `{{${selectedText}}}`;
      
      newValue = currentVal.slice(0, lastOpenBrace) + replacement + currentVal.slice(cursorPos);
      newCursorPos = lastOpenBrace + replacement.length;
    } else {
      newValue = selectedText;
      newCursorPos = selectedText.length;
    }

    const fieldId = suggestState.fieldId;
    if (fieldId === 'url') {
      onChangeRequestState({ ...requestState, url: newValue });
    } else if (fieldId.startsWith('param-')) {
      const [,, index, keyOrValue] = fieldId.split('-');
      const idx = parseInt(index);
      updateList(params, idx, keyOrValue as any, newValue, 'params');
    } else if (fieldId.startsWith('header-')) {
      const [,, index, keyOrValue] = fieldId.split('-');
      const idx = parseInt(index);
      updateList(headers, idx, keyOrValue as any, newValue, 'headers');
    } else if (fieldId.startsWith('body-fd-')) {
      const [,,, index, keyOrValue] = fieldId.split('-');
      const idx = parseInt(index);
      updateList(body.formData, idx, keyOrValue as any, newValue, 'formData');
    } else if (fieldId.startsWith('body-ue-')) {
      const [,,, index, keyOrValue] = fieldId.split('-');
      const idx = parseInt(index);
      updateList(body.urlencoded, idx, keyOrValue as any, newValue, 'urlencoded');
    }

    setSuggestState(prev => ({ ...prev, visible: false }));

    setTimeout(() => {
      if (input) {
        input.focus();
        input.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestState.visible) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSuggestState(prev => ({
        ...prev,
        index: (prev.index + 1) % prev.items.length
      }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSuggestState(prev => ({
        ...prev,
        index: (prev.index - 1 + prev.items.length) % prev.items.length
      }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSuggestionSelect(suggestState.items[suggestState.index]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSuggestState(prev => ({ ...prev, visible: false }));
    }
  };

  useEffect(() => {
    const handleOutsideClick = () => {
      setSuggestState(prev => ({ ...prev, visible: false }));
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Update lists with auto-activation key checks
  const updateList = (
    list: KeyValuePair[], 
    index: number, 
    field: keyof KeyValuePair, 
    value: any,
    listName: 'params' | 'headers' | 'formData' | 'urlencoded'
  ) => {
    const newList = [...list];
    newList[index] = {
      ...newList[index],
      [field]: value
    };

    // Auto-enable row if user starts typing in a key or value
    if (field === 'key' || field === 'value') {
      if (value.trim()) {
        newList[index].enabled = true;
      }
    }

    const lastItem = newList[newList.length - 1];
    if (lastItem && (lastItem.key || lastItem.value) && index === newList.length - 1) {
      newList.push({
        id: Math.random().toString(36).substring(2, 9),
        key: '',
        value: '',
        description: '',
        enabled: true
      });
    }

    if (listName === 'params') {
      onChangeRequestState({ ...requestState, params: newList });
    } else if (listName === 'headers') {
      onChangeRequestState({ ...requestState, headers: newList });
    } else if (listName === 'formData') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, formData: newList }
      });
    } else if (listName === 'urlencoded') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, urlencoded: newList }
      });
    }
  };

  const removeRow = (
    list: KeyValuePair[], 
    index: number,
    listName: 'params' | 'headers' | 'formData' | 'urlencoded'
  ) => {
    const newList = list.filter((_, i) => i !== index);
    
    if (newList.length === 0) {
      newList.push({
        id: Math.random().toString(36).substring(2, 9),
        key: '',
        value: '',
        description: '',
        enabled: true
      });
    }

    if (listName === 'params') {
      onChangeRequestState({ ...requestState, params: newList });
    } else if (listName === 'headers') {
      onChangeRequestState({ ...requestState, headers: newList });
    } else if (listName === 'formData') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, formData: newList }
      });
    } else if (listName === 'urlencoded') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, urlencoded: newList }
      });
    }
  };

  const addEmptyRow = (listName: 'params' | 'headers' | 'formData' | 'urlencoded') => {
    const newRow = {
      id: Math.random().toString(36).substring(2, 9),
      key: '',
      value: '',
      description: '',
      enabled: true
    };

    if (listName === 'params') {
      onChangeRequestState({ ...requestState, params: [...params, newRow] });
    } else if (listName === 'headers') {
      onChangeRequestState({ ...requestState, headers: [...headers, newRow] });
    } else if (listName === 'formData') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, formData: [...body.formData, newRow] }
      });
    } else if (listName === 'urlencoded') {
      onChangeRequestState({
        ...requestState,
        body: { ...body, urlencoded: [...body.urlencoded, newRow] }
      });
    }
  };

  const handleAuthTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeRequestState({
      ...requestState,
      auth: {
        ...auth,
        type: e.target.value as AuthType
      }
    });
  };

  const handleAuthStateChange = (authType: keyof AuthState, field: string, value: any) => {
    onChangeRequestState({
      ...requestState,
      auth: {
        ...auth,
        state: {
          ...auth.state,
          [authType]: {
            ...auth.state[authType],
            [field]: value
          }
        }
      }
    });
  };

  const handleBodyTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as BodyType;
    const updatedBody = { ...body, type };
    if (type === 'form-data' && body.formData.length === 0) {
      updatedBody.formData = [{ id: '1', key: '', value: '', enabled: true }];
    } else if (type === 'x-www-form-urlencoded' && body.urlencoded.length === 0) {
      updatedBody.urlencoded = [{ id: '1', key: '', value: '', enabled: true }];
    }

    onChangeRequestState({
      ...requestState,
      body: updatedBody
    });
  };

  const handleRawBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonError(null);
    onChangeRequestState({
      ...requestState,
      body: {
        ...body,
        rawContent: e.target.value
      }
    });
  };

  const handleBeautifyJson = () => {
    if (!body.rawContent.trim()) return;
    try {
      const parsed = JSON.parse(body.rawContent);
      const formatted = JSON.stringify(parsed, null, 2);
      onChangeRequestState({
        ...requestState,
        body: {
          ...body,
          rawContent: formatted
        }
      });
      setJsonError(null);
    } catch (err: any) {
      setJsonError("Invalid JSON: " + err.message);
    }
  };

  const handleRawTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeRequestState({
      ...requestState,
      body: {
        ...body,
        rawType: e.target.value as RawBodyType
      }
    });
  };

  const safeParams = params.length > 0 ? params : [{ id: 'empty-p', key: '', value: '', enabled: true }];
  const safeHeaders = headers.length > 0 ? headers : [{ id: 'empty-h', key: '', value: '', enabled: true }];
  const safeFormData = body.formData.length > 0 ? body.formData : [{ id: 'empty-fd', key: '', value: '', enabled: true }];
  const safeUrlencoded = body.urlencoded.length > 0 ? body.urlencoded : [{ id: 'empty-ue', key: '', value: '', enabled: true }];

  // Calculate Auto-generated headers dynamically
  const getCalculatedHeaders = (): { key: string; value: string; source: string }[] => {
    const list: { key: string; value: string; source: string }[] = [];
    
    if (auth.type === 'bearer' && auth.state.bearer.token) {
      list.push({ key: 'Authorization', value: `Bearer ${auth.state.bearer.token}`, source: 'Bearer Auth' });
    } else if (auth.type === 'basic' && (auth.state.basic.username || auth.state.basic.password)) {
      const credentials = `${auth.state.basic.username}:${auth.state.basic.password}`;
      list.push({ key: 'Authorization', value: `Basic ${btoa(credentials)}`, source: 'Basic Auth' });
    } else if (auth.type === 'apikey' && auth.state.apiKey.addTo === 'headers' && auth.state.apiKey.key) {
      list.push({ key: auth.state.apiKey.key, value: auth.state.apiKey.value, source: 'API Key Auth' });
    }

    if (method !== 'GET' && method !== 'HEAD') {
      if (body.type === 'raw' && body.rawType === 'json') {
        list.push({ key: 'Content-Type', value: 'application/json', source: 'Body (JSON)' });
      } else if (body.type === 'x-www-form-urlencoded') {
        list.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', source: 'Body (urlencoded)' });
      } else if (body.type === 'form-data') {
        list.push({ key: 'Content-Type', value: 'application/json', source: 'Body (form-data)' });
      }
    }

    return list;
  };

  const calculatedHeaders = getCalculatedHeaders();

  const handleImportCurl = () => {
    try {
      if (curlInput.trim()) {
        const parsed = parseCurl(curlInput);
        onChangeRequestState(parsed);
        setShowCurlModal(false);
        setCurlInput('');
        setToastMessage("Imported cURL request details successfully!");
      }
    } catch (err: any) {
      alert('Error parsing cURL: ' + err.message);
    }
  };

  const handleCopyCurl = () => {
    const curl = generateCurl(requestState);
    navigator.clipboard.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#37352f',
          color: '#ffffff',
          padding: '6px 16px',
          borderRadius: '4px',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles size={14} style={{ color: 'var(--color-warning)' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top URL input row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <select 
          value={method} 
          onChange={handleMethodChange}
          style={{
            fontWeight: '600',
            fontSize: '14px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '4px'
          }}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        
        <input 
          type="text" 
          placeholder="Enter request URL or paste cURL command..." 
          value={url}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '14px',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}
        />

        <button 
          onClick={onSend} 
          disabled={isLoading}
          className="primary"
          style={{
            padding: '8px 24px',
            fontWeight: '500',
            minWidth: '90px'
          }}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>

        <button 
          onClick={() => setShowCurlModal(true)} 
          style={{
            border: '1px solid var(--border-color)',
            fontSize: '13px',
            padding: '8px 12px'
          }}
        >
          Import cURL
        </button>

        <button 
          onClick={handleCopyCurl} 
          title="Copy as cURL"
          style={{
            border: '1px solid var(--border-color)',
            padding: '8px',
            aspectRatio: '1'
          }}
        >
          {copiedCurl ? <Check size={16} style={{ color: 'var(--color-success)' }} /> : <Copy size={16} />}
        </button>
      </div>

      {/* Sub tabs container */}
      <div>
        <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0px', marginBottom: '12px' }}>
          {(['params', 'headers', 'body', 'auth'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                fontSize: '13px',
                fontWeight: activeTab === tab ? '600' : '400',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab ? '2px solid var(--text-primary)' : '2px solid transparent',
                borderRadius: '0px',
                padding: '6px 4px',
                textTransform: 'capitalize'
              }}
            >
              {tab}
              {tab === 'params' && params.filter(p => p.key).length > 0 && ` (${params.filter(p => p.key).length})`}
              {tab === 'headers' && (headers.filter(h => h.key).length + calculatedHeaders.length) > 0 && ` (${headers.filter(h => h.key).length + calculatedHeaders.length})`}
              {tab === 'body' && body.type !== 'none' && ' •'}
              {tab === 'auth' && auth.type !== 'none' && ' •'}
            </button>
          ))}
        </div>

        {/* Tab content panels */}
        <div style={{ minHeight: '120px' }}>
          {/* PARAMS TAB */}
          {activeTab === 'params' && (
            <div>
              <table className="notion-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Description</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {safeParams.map((param, index) => (
                    <tr key={param.id} style={{ opacity: param.enabled ? 1 : 0.5, transition: 'opacity 0.15s ease' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={param.enabled} 
                          onChange={(e) => updateList(params, index, 'enabled', e.target.checked, 'params')}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          placeholder="Parameter" 
                          value={param.key} 
                          onChange={(e) => {
                            updateList(params, index, 'key', e.target.value, 'params');
                            handleInputAutocomplete(e.target, `param-key-${index}`, e.target.value);
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          placeholder="Value" 
                          value={param.value} 
                          onChange={(e) => {
                            updateList(params, index, 'value', e.target.value, 'params');
                            handleInputAutocomplete(e.target, `param-value-${index}`, e.target.value);
                          }}
                          onKeyDown={handleKeyDown}
                        />
                      </td>
                      <td>
                        <input 
                          type="text" 
                          placeholder="Description" 
                          value={param.description || ''} 
                          onChange={(e) => updateList(params, index, 'description', e.target.value, 'params')}
                        />
                      </td>
                      <td>
                        <button className="notion-icon-btn" onClick={() => removeRow(params, index, 'params')}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                onClick={() => addEmptyRow('params')} 
                style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '6px' }}
              >
                <Plus size={12} /> Add Row
              </button>
            </div>
          )}

          {/* HEADERS TAB */}
          {activeTab === 'headers' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <table className="notion-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}></th>
                      <th>Header Key</th>
                      <th>Value</th>
                      <th>Description</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeHeaders.map((header, index) => (
                      <tr key={header.id} style={{ opacity: header.enabled ? 1 : 0.5, transition: 'opacity 0.15s ease' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={header.enabled} 
                            onChange={(e) => updateList(headers, index, 'enabled', e.target.checked, 'headers')}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            placeholder="e.g. Content-Type" 
                            value={header.key} 
                            onChange={(e) => {
                              updateList(headers, index, 'key', e.target.value, 'headers');
                              handleInputAutocomplete(e.target, `header-key-${index}`, e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            placeholder="Value" 
                            value={header.value} 
                            onChange={(e) => {
                              updateList(headers, index, 'value', e.target.value, 'headers');
                              handleInputAutocomplete(e.target, `header-value-${index}`, e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            placeholder="Description" 
                            value={header.description || ''} 
                            onChange={(e) => updateList(headers, index, 'description', e.target.value, 'headers')}
                          />
                        </td>
                        <td>
                          <button className="notion-icon-btn" onClick={() => removeRow(headers, index, 'headers')}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button 
                  onClick={() => addEmptyRow('headers')} 
                  style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '6px' }}
                >
                  <Plus size={12} /> Add Row
                </button>
              </div>

              {/* Calculated Headers Collapsible Panel */}
              {calculatedHeaders.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <button 
                    onClick={() => setShowCalculatedHeaders(!showCalculatedHeaders)}
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '4px 0', fontWeight: '500' }}
                  >
                    {showCalculatedHeaders ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Calculated Headers ({calculatedHeaders.length})
                  </button>
                  
                  {showCalculatedHeaders && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '4px' }}>
                      <table className="notion-table" style={{ backgroundColor: 'transparent' }}>
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calculatedHeaders.map((ch, idx) => (
                            <tr key={idx} style={{ opacity: 0.8 }}>
                              <td style={{ fontWeight: '500' }}>{ch.key}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{ch.value}</td>
                              <td style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                {ch.source}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BODY TAB */}
          {activeTab === 'body' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select 
                  value={body.type} 
                  onChange={handleBodyTypeChange}
                  style={{ fontSize: '13px', padding: '4px 8px' }}
                >
                  <option value="none">none (No body)</option>
                  <option value="raw">raw (Text, JSON, XML, HTML)</option>
                  <option value="x-www-form-urlencoded">x-www-form-urlencoded</option>
                  <option value="form-data">form-data</option>
                </select>

                {body.type === 'raw' && (
                  <select 
                    value={body.rawType} 
                    onChange={handleRawTypeChange}
                    style={{ fontSize: '13px', padding: '4px 8px' }}
                  >
                    <option value="json">JSON</option>
                    <option value="text">Text</option>
                    <option value="xml">XML</option>
                    <option value="html">HTML</option>
                  </select>
                )}

                {body.type === 'raw' && body.rawType === 'json' && body.rawContent.trim() && (
                  <button 
                    onClick={handleBeautifyJson} 
                    style={{
                      fontSize: '11px',
                      border: '1px solid var(--border-color)',
                      padding: '3px 8px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Beautify JSON
                  </button>
                )}
              </div>

              {jsonError && (
                <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{jsonError}</div>
              )}

              {/* CodeMirror 6 JSON Editor Integration */}
              {body.type === 'raw' && body.rawType === 'json' && (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <CodeMirror
                    value={body.rawContent}
                    height="180px"
                    extensions={[jsonLang(), notionThemeExtension]}
                    onChange={(value) => {
                      setJsonError(null);
                      onChangeRequestState({
                        ...requestState,
                        body: {
                          ...body,
                          rawContent: value
                        }
                      });
                    }}
                  />
                </div>
              )}

              {/* Standard textareas for non-JSON content */}
              {body.type === 'raw' && body.rawType !== 'json' && (
                <textarea
                  value={body.rawContent}
                  onChange={handleRawBodyChange}
                  placeholder="Request body payload..."
                  style={{
                    width: '100%',
                    height: '180px',
                    fontFamily: 'Courier, monospace',
                    fontSize: '13px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    resize: 'vertical'
                  }}
                />
              )}

              {body.type === 'form-data' && (
                <div>
                  <table className="notion-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Field Key</th>
                        <th>Value</th>
                        <th>Description</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeFormData.map((item, index) => (
                        <tr key={item.id} style={{ opacity: item.enabled ? 1 : 0.5, transition: 'opacity 0.15s ease' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={item.enabled} 
                              onChange={(e) => updateList(body.formData, index, 'enabled', e.target.checked, 'formData')}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Key" 
                              value={item.key} 
                              onChange={(e) => {
                                updateList(body.formData, index, 'key', e.target.value, 'formData');
                                handleInputAutocomplete(e.target, `body-fd-${index}-key`, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Value" 
                              value={item.value} 
                              onChange={(e) => {
                                updateList(body.formData, index, 'value', e.target.value, 'formData');
                                handleInputAutocomplete(e.target, `body-fd-${index}-value`, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Description" 
                              value={item.description || ''} 
                              onChange={(e) => updateList(body.formData, index, 'description', e.target.value, 'formData')}
                            />
                          </td>
                          <td>
                            <button className="notion-icon-btn" onClick={() => removeRow(body.formData, index, 'formData')}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    onClick={() => addEmptyRow('formData')} 
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '6px' }}
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>
              )}

              {body.type === 'x-www-form-urlencoded' && (
                <div>
                  <table className="notion-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th>Field Key</th>
                        <th>Value</th>
                        <th>Description</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeUrlencoded.map((item, index) => (
                        <tr key={item.id} style={{ opacity: item.enabled ? 1 : 0.5, transition: 'opacity 0.15s ease' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={item.enabled} 
                              onChange={(e) => updateList(body.urlencoded, index, 'enabled', e.target.checked, 'urlencoded')}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Key" 
                              value={item.key} 
                              onChange={(e) => {
                                updateList(body.urlencoded, index, 'key', e.target.value, 'urlencoded');
                                handleInputAutocomplete(e.target, `body-ue-${index}-key`, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Value" 
                              value={item.value} 
                              onChange={(e) => {
                                updateList(body.urlencoded, index, 'value', e.target.value, 'urlencoded');
                                handleInputAutocomplete(e.target, `body-ue-${index}-value`, e.target.value);
                              }}
                              onKeyDown={handleKeyDown}
                            />
                          </td>
                          <td>
                            <input 
                              type="text" 
                              placeholder="Description" 
                              value={item.description || ''} 
                              onChange={(e) => updateList(body.urlencoded, index, 'description', e.target.value, 'urlencoded')}
                            />
                          </td>
                          <td>
                            <button className="notion-icon-btn" onClick={() => removeRow(body.urlencoded, index, 'urlencoded')}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button 
                    onClick={() => addEmptyRow('urlencoded')} 
                    style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '6px 8px', marginTop: '6px' }}
                  >
                    <Plus size={12} /> Add Row
                  </button>
                </div>
              )}

              {body.type === 'none' && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', padding: '10px 0' }}>
                  This request does not have a body.
                </div>
              )}
            </div>
          )}

          {/* AUTH TAB */}
          {activeTab === 'auth' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Auth Type</label>
                <select 
                  value={auth.type} 
                  onChange={handleAuthTypeChange}
                  style={{ fontSize: '13px', padding: '6px' }}
                >
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apikey">API Key</option>
                </select>
              </div>

              {auth.type === 'bearer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Token</label>
                  <input
                    type="text"
                    placeholder="Bearer token"
                    value={auth.state.bearer.token}
                    onChange={(e) => {
                      handleAuthStateChange('bearer', 'token', e.target.value);
                      handleInputAutocomplete(e.target, 'auth-bearer-token', e.target.value);
                    }}
                    onKeyDown={handleKeyDown}
                    style={{ padding: '6px', fontSize: '13px' }}
                  />
                </div>
              )}

              {auth.type === 'basic' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Username</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={auth.state.basic.username}
                      onChange={(e) => {
                        handleAuthStateChange('basic', 'username', e.target.value);
                        handleInputAutocomplete(e.target, 'auth-basic-username', e.target.value);
                      }}
                      onKeyDown={handleKeyDown}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Password</label>
                    <input
                      type="password"
                      placeholder="Password"
                      value={auth.state.basic.password}
                      onChange={(e) => handleAuthStateChange('basic', 'password', e.target.value)}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                </div>
              )}

              {auth.type === 'apikey' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Key</label>
                    <input
                      type="text"
                      placeholder="API Key Name"
                      value={auth.state.apiKey.key}
                      onChange={(e) => {
                        handleAuthStateChange('apiKey', 'key', e.target.value);
                        handleInputAutocomplete(e.target, 'auth-apikey-key', e.target.value);
                      }}
                      onKeyDown={handleKeyDown}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Value</label>
                    <input
                      type="text"
                      placeholder="API Key Value"
                      value={auth.state.apiKey.value}
                      onChange={(e) => {
                        handleAuthStateChange('apiKey', 'value', e.target.value);
                        handleInputAutocomplete(e.target, 'auth-apikey-value', e.target.value);
                      }}
                      onKeyDown={handleKeyDown}
                      style={{ padding: '6px', fontSize: '13px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>Add to</label>
                    <select
                      value={auth.state.apiKey.addTo}
                      onChange={(e) => handleAuthStateChange('apiKey', 'addTo', e.target.value)}
                      style={{ padding: '6px', fontSize: '13px' }}
                    >
                      <option value="headers">Headers</option>
                      <option value="queryParams">Query Params</option>
                    </select>
                  </div>
                </div>
              )}

              {auth.type === 'none' && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                  No authentication headers will be sent.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating suggestions dropdown */}
      {suggestState.visible && suggestState.items.length > 0 && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: `${suggestState.coords.top}px`,
            left: `${suggestState.coords.left}px`,
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            boxShadow: '0 8px 16px rgba(15, 15, 15, 0.1)',
            zIndex: 99999,
            minWidth: '200px',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '4px 0'
          }}
        >
          {suggestState.items.map((item, idx) => {
            const isSelected = idx === suggestState.index;
            return (
              <div
                key={item}
                onClick={() => handleSuggestionSelect(item)}
                onMouseEnter={() => setSuggestState(prev => ({ ...prev, index: idx }))}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {suggestState.type === 'variable' ? (
                  <>
                    <span style={{
                      fontWeight: 'bold',
                      color: 'var(--method-get)',
                      fontFamily: 'monospace'
                    }}>{"{ }"}</span>
                    <span style={{ fontWeight: '500' }}>{item}</span>
                  </>
                ) : (
                  <>
                    <Terminal size={10} style={{ color: 'var(--text-secondary)' }} />
                    <span>{item}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* cURL Import Modal */}
      {showCurlModal && (
        <div className="notion-modal-overlay">
          <div className="notion-modal" style={{ width: '550px' }}>
            <div className="notion-modal-header">
              <h3 style={{ fontSize: '16px' }}>Import cURL Command</h3>
              <button onClick={() => setShowCurlModal(false)}>×</button>
            </div>
            <div className="notion-modal-body">
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Paste a raw cURL command below to import its method, URL, headers, and request body.
              </p>
              <textarea
                value={curlInput}
                onChange={(e) => setCurlInput(e.target.value)}
                placeholder="curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{...}'"
                style={{
                  width: '100%',
                  height: '180px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  resize: 'none'
                }}
              />
            </div>
            <div className="notion-modal-footer">
              <button onClick={() => setShowCurlModal(false)}>Cancel</button>
              <button className="primary" onClick={handleImportCurl} disabled={!curlInput.trim()}>
                Import Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
