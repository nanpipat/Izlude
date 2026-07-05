export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  description?: string;
  enabled: boolean;
}

export type AuthType = 'none' | 'apikey' | 'bearer' | 'basic';

export interface AuthState {
  apiKey: {
    key: string;
    value: string;
    addTo: 'headers' | 'queryParams';
  };
  bearer: {
    token: string;
  };
  basic: {
    username: string;
    password: string;
  };
}

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
export type RawBodyType = 'text' | 'json' | 'xml' | 'html';

export interface BodyState {
  type: BodyType;
  rawType: RawBodyType;
  rawContent: string;
  formData: KeyValuePair[];
  urlencoded: KeyValuePair[];
}

export interface RequestState {
  method: Method;
  url: string;
  params: KeyValuePair[];
  headers: KeyValuePair[];
  body: BodyState;
  auth: {
    type: AuthType;
    state: AuthState;
  };
}

export interface ResponseState {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  isBinary: boolean;
  timeMs: number;
  size: number;
  error?: boolean;
}

export interface Tab {
  id: string;
  name: string;
  requestState: RequestState;
  responseState: ResponseState | null;
  isLoading: boolean;
  isDirty: boolean;
}

export interface EnvironmentVariable {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface SavedRequest {
  id: string;
  name: string;
  requestState: RequestState;
}

export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: Method;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  requestState: RequestState;
}

export const DEFAULT_REQUEST_STATE: RequestState = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  body: {
    type: 'none',
    rawType: 'json',
    rawContent: '',
    formData: [],
    urlencoded: []
  },
  auth: {
    type: 'none',
    state: {
      apiKey: { key: '', value: '', addTo: 'headers' },
      bearer: { token: '' },
      basic: { username: '', password: '' }
    }
  }
};
