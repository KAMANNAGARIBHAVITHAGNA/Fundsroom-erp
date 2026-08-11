import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { subscribeToDatabaseChanges, RealtimeStatus } from '../services/realtimeService';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string; // ADMIN, SALES, WAREHOUSE, ACCOUNTS
  demo?: boolean;
}

// Data domains that can be invalidated
export type DataDomain = 'inventory' | 'challans' | 'customers' | 'activity' | 'intelligence';

interface AppContextType {
  user: User | null;
  token: string | null;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedIntelProductId: string | null;
  setSelectedIntelProductId: (id: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<any>;
  // ── Real-time sync ──────────────────────────────────────────
  dataVersion: Record<DataDomain, number>;
  signalDataChange: (...domains: DataDomain[]) => void;
  lastSyncTime: Date | null;
  realtimeStatus: RealtimeStatus;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_DATA_VERSION: Record<DataDomain, number> = {
  inventory:    0,
  challans:     0,
  customers:    0,
  activity:     0,
  intelligence: 0,
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [currentTab, setCurrentTab]   = useState<string>('dashboard');
  const [selectedIntelProductId, setSelectedIntelProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Event bus state ─────────────────────────────────────────
  const [dataVersion, setDataVersion] = useState<Record<DataDomain, number>>(INITIAL_DATA_VERSION);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('OFFLINE');

  const prevStatusRef = useRef<RealtimeStatus>('OFFLINE');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser  = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setCurrentTab('dashboard');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCurrentTab('dashboard');
    setSelectedIntelProductId(null);
  };

  // ── apiFetch keeps token reference stable via closure ───────
  const apiFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const currentToken = localStorage.getItem('token');
    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    headers.set('Content-Type', 'application/json');

    const res  = await fetch(endpoint, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Something went wrong');
    }
    return data;
  }, []);

  /**
   * Signal that one or more data domains have changed.
   * Any component subscribed to those domains will re-fetch.
   */
  const signalDataChange = useCallback((...domains: DataDomain[]) => {
    setDataVersion(prev => {
      const next = { ...prev };
      domains.forEach(d => { next[d] = prev[d] + 1; });
      return next;
    });
    setLastSyncTime(new Date());
  }, []);

  // Refs to keep callback references stable for Supabase Realtime subscriptions
  const onEventRef = useRef((domain: string, eventType: string, _payload: any) => {
    console.log(`Supabase Event [${eventType}] -> invalidating domain: [${domain}]`);
    signalDataChange(domain as DataDomain);
  });
  onEventRef.current = (domain: string, eventType: string, _payload: any) => {
    console.log(`Supabase Event [${eventType}] -> invalidating domain: [${domain}]`);
    signalDataChange(domain as DataDomain);
  };

  const onStatusChangeRef = useRef<(status: RealtimeStatus) => void>(() => {});
  onStatusChangeRef.current = (status: RealtimeStatus) => {
    setRealtimeStatus(status);
    if (status === 'CONNECTED' && prevStatusRef.current !== 'CONNECTED') {
      console.log('Realtime database connection restored. Refreshing all cache domains...');
      signalDataChange('inventory', 'challans', 'customers', 'activity');
    }
    prevStatusRef.current = status;
  };

  // Setup Supabase Realtime subscriptions when authenticated token is set
  useEffect(() => {
    if (!token) {
      setRealtimeStatus('OFFLINE');
      return;
    }

    const sub = subscribeToDatabaseChanges({
      onEvent: (domain, eventType, payload) => onEventRef.current(domain, eventType, payload),
      onStatusChange: (status) => onStatusChangeRef.current(status)
    }, token);

    return () => {
      sub.unsubscribe();
    };
  }, [token]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#F7F8FC',
        color: '#0F172A',
        fontFamily: 'var(--font-sans, sans-serif)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            marginBottom: '1rem',
            color: '#5B5CEB',
            animation: 'pulse 1.5s infinite',
          }}>✦</div>
          <div style={{ color: '#64748B', fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            INITIALIZING...
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      user, token, currentTab, setCurrentTab,
      selectedIntelProductId, setSelectedIntelProductId,
      login, logout, apiFetch,
      dataVersion, signalDataChange, lastSyncTime,
      realtimeStatus,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
