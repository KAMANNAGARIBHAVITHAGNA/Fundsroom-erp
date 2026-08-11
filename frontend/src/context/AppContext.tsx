import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  subscribeToDatabaseChanges,
  RealtimeStatus,
} from '../services/realtimeService';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string; // ADMIN, SALES, WAREHOUSE, ACCOUNTS
  demo?: boolean;
}

export type DataDomain =
  | 'inventory'
  | 'challans'
  | 'customers'
  | 'activity'
  | 'intelligence';

interface AppContextType {
  user: User | null;
  token: string | null;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedIntelProductId: string | null;
  setSelectedIntelProductId: (id: string | null) => void;
  login: (token: string, user: User) => void;
  logout: () => void;
  apiFetch: (
    endpoint: string,
    options?: RequestInit
  ) => Promise<any>;

  dataVersion: Record<DataDomain, number>;
  signalDataChange: (...domains: DataDomain[]) => void;
  lastSyncTime: Date | null;
  realtimeStatus: RealtimeStatus;
}

const AppContext = createContext<AppContextType | undefined>(
  undefined
);

const INITIAL_DATA_VERSION: Record<DataDomain, number> = {
  inventory: 0,
  challans: 0,
  customers: 0,
  activity: 0,
  intelligence: 0,
};

export const AppProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [currentTab, setCurrentTab] =
    useState<string>('dashboard');

  const [selectedIntelProductId, setSelectedIntelProductId] =
    useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  // Event bus state
  const [dataVersion, setDataVersion] =
    useState<Record<DataDomain, number>>(
      INITIAL_DATA_VERSION
    );

  const [lastSyncTime, setLastSyncTime] =
    useState<Date | null>(null);

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>('OFFLINE');

  const prevStatusRef =
    useRef<RealtimeStatus>('OFFLINE');

  // Restore existing login session
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error(
          'Failed to restore user session:',
          error
        );

        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
  }, []);

  // Login
  const login = (
    newToken: string,
    newUser: User
  ) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem(
      'user',
      JSON.stringify(newUser)
    );

    setToken(newToken);
    setUser(newUser);
    setCurrentTab('dashboard');
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setToken(null);
    setUser(null);
    setCurrentTab('dashboard');
    setSelectedIntelProductId(null);
  };

  // ============================================================
  // API FETCH
  // ============================================================

  const apiFetch = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {}
    ): Promise<any> => {
      const currentToken =
        localStorage.getItem('token');

      /*
       * Railway backend
       *
       * Frontend is deployed on Vercel.
       * Backend is deployed on Railway.
       */
      const apiBaseUrl =
        'https://fundsroom-erp-production-0ee1.up.railway.app';

      // Remove trailing slash
      const cleanBaseUrl =
        apiBaseUrl.replace(/\/+$/, '');

      // Make sure endpoint starts with /
      const cleanEndpoint =
        endpoint.startsWith('/')
          ? endpoint
          : `/${endpoint}`;

      // Final API URL
      const url =
        `${cleanBaseUrl}${cleanEndpoint}`;

      console.log('API Request:', url);

      const headers = new Headers(
        options.headers || {}
      );

      // Add JWT token
      if (currentToken) {
        headers.set(
          'Authorization',
          `Bearer ${currentToken}`
        );
      }

      // Add JSON content type when sending a body
      if (options.body) {
        headers.set(
          'Content-Type',
          'application/json'
        );
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      /*
       * Handle JSON and non-JSON responses safely.
       *
       * This prevents:
       * Unexpected token 'T'
       *
       * when the server returns plain text/HTML.
       */
      const contentType =
        response.headers.get(
          'content-type'
        ) || '';

      let data: any;

      if (
        contentType.includes(
          'application/json'
        )
      ) {
        data = await response.json();
      } else {
        const text =
          await response.text();

        console.error(
          'Non-JSON API response:',
          response.status,
          text
        );

        throw new Error(
          text ||
          `Request failed with status ${response.status}`
        );
      }

      // Handle API errors
      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
          data?.message ||
          data?.error ||
          `Request failed with status ${response.status}`
        );
      }

      return data;
    },
    []
  );

  // ============================================================
  // DATA CHANGE SIGNAL
  // ============================================================

  const signalDataChange = useCallback(
    (...domains: DataDomain[]) => {
      setDataVersion((prev) => {
        const next = { ...prev };

        domains.forEach((domain) => {
          next[domain] =
            prev[domain] + 1;
        });

        return next;
      });

      setLastSyncTime(new Date());
    },
    []
  );

  // ============================================================
  // SUPABASE REALTIME
  // ============================================================

  const onEventRef = useRef(
    (
      domain: string,
      eventType: string,
      _payload: any
    ) => {
      console.log(
        `Supabase Event [${eventType}] -> invalidating domain: [${domain}]`
      );

      signalDataChange(
        domain as DataDomain
      );
    }
  );

  onEventRef.current = (
    domain: string,
    eventType: string,
    _payload: any
  ) => {
    console.log(
      `Supabase Event [${eventType}] -> invalidating domain: [${domain}]`
    );

    signalDataChange(
      domain as DataDomain
    );
  };

  const onStatusChangeRef =
    useRef<
      (status: RealtimeStatus) => void
    >(() => { });

  onStatusChangeRef.current = (
    status: RealtimeStatus
  ) => {
    setRealtimeStatus(status);

    if (
      status === 'CONNECTED' &&
      prevStatusRef.current !==
      'CONNECTED'
    ) {
      console.log(
        'Realtime database connection restored. Refreshing all cache domains...'
      );

      signalDataChange(
        'inventory',
        'challans',
        'customers',
        'activity'
      );
    }

    prevStatusRef.current =
      status;
  };

  // Setup Supabase Realtime
  useEffect(() => {
    if (!token) {
      setRealtimeStatus('OFFLINE');
      return;
    }

    const sub =
      subscribeToDatabaseChanges(
        {
          onEvent: (
            domain,
            eventType,
            payload
          ) =>
            onEventRef.current(
              domain,
              eventType,
              payload
            ),

          onStatusChange: (
            status
          ) =>
            onStatusChangeRef.current(
              status
            ),
        },
        token
      );

    return () => {
      sub.unsubscribe();
    };
  }, [token]);

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#F7F8FC',
          color: '#0F172A',
          fontFamily:
            'var(--font-sans, sans-serif)',
        }}
      >
        <div
          style={{
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '2rem',
              marginBottom: '1rem',
              color: '#5B5CEB',
              animation:
                'pulse 1.5s infinite',
            }}
          >
            ✦
          </div>

          <div
            style={{
              color: '#64748B',
              fontSize: '0.85rem',
              fontFamily:
                'monospace',
              letterSpacing:
                '0.05em',
            }}
          >
            INITIALIZING...
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PROVIDER
  // ============================================================

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        currentTab,
        setCurrentTab,

        selectedIntelProductId,
        setSelectedIntelProductId,

        login,
        logout,
        apiFetch,

        dataVersion,
        signalDataChange,
        lastSyncTime,
        realtimeStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

// ============================================================
// useApp HOOK
// ============================================================

export const useApp = () => {
  const context =
    useContext(AppContext);

  if (!context) {
    throw new Error(
      'useApp must be used within an AppProvider'
    );
  }

  return context;
};