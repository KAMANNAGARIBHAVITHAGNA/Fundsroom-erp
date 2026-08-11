import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export let supabase: ReturnType<typeof createClient> | null = null;

try {
  if (
    supabaseUrl && 
    supabaseAnonKey && 
    !supabaseUrl.includes('your-project') && 
    !supabaseAnonKey.includes('your-anon-key')
  ) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) {
  console.warn('Failed to initialize Supabase client:', e);
}

export type RealtimeStatus = 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE';

export interface RealtimeSubscriptionHandlers {
  onEvent: (domain: string, eventType: string, payload: any) => void;
  onStatusChange: (status: RealtimeStatus) => void;
}

export function subscribeToDatabaseChanges(
  handlers: RealtimeSubscriptionHandlers,
  token: string | null
): { unsubscribe: () => void } {
  if (!supabase) {
    console.warn('Supabase client not initialized. Realtime subscriptions are inactive.');
    handlers.onStatusChange('OFFLINE');
    return { unsubscribe: () => {} };
  }

  handlers.onStatusChange('CONNECTING');

  // If there's an authenticated user JWT token, set it on the Realtime connection
  if (token) {
    try {
      supabase.realtime.setAuth(token);
    } catch (e) {
      console.error('Error setting auth token for Supabase Realtime:', e);
    }
  }

  let reconnectTimeout: any = null;
  let isUnsubscribed = false;
  let channel: RealtimeChannel | null = null;

  const setupChannel = () => {
    if (isUnsubscribed) return;

    console.log('Setting up Supabase Realtime channel for table changes...');
    
    // Create a new realtime channel
    channel = supabase!.channel('public-db-changes');

    // Subscribe to customers changes
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customers' },
        (payload) => {
          console.log('Realtime event received (customers):', payload);
          handlers.onEvent('customers', payload.eventType, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_notes' },
        (payload) => {
          console.log('Realtime event received (customer_notes):', payload);
          handlers.onEvent('customers', payload.eventType, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Realtime event received (products):', payload);
          handlers.onEvent('inventory', payload.eventType, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements' },
        (payload) => {
          console.log('Realtime event received (stock_movements):', payload);
          handlers.onEvent('inventory', payload.eventType, payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'challans' },
        (payload) => {
          console.log('Realtime event received (challans):', payload);
          // If a challan is confirmed or cancelled, status change affects stock levels,
          // so we signal both challans and inventory.
          const status = payload.new ? (payload.new as any).status : null;
          if (status === 'Confirmed' || status === 'Cancelled') {
            handlers.onEvent('challans', payload.eventType, payload);
            handlers.onEvent('inventory', payload.eventType, payload);
          } else {
            handlers.onEvent('challans', payload.eventType, payload);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        (payload) => {
          console.log('Realtime event received (activity_logs):', payload);
          handlers.onEvent('activity', payload.eventType, payload);
        }
      );

    channel.subscribe((status, err) => {
      if (isUnsubscribed) return;

      console.log(`Supabase Realtime status: ${status}`, err || '');

      if (status === 'SUBSCRIBED') {
        handlers.onStatusChange('CONNECTED');
      } else if (status === 'CLOSED') {
        handlers.onStatusChange('OFFLINE');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        handlers.onStatusChange('RECONNECTING');
        
        // Simple retry logic if disconnected by channel error
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          if (!isUnsubscribed) {
            console.log('Reconnecting Supabase Realtime...');
            setupChannel();
          }
        }, 5000);
      }
    });
  };

  setupChannel();

  // Listen to network status changes (online/offline)
  const handleOnline = () => {
    console.log('Browser back online. Restoring Realtime subscription...');
    handlers.onStatusChange('CONNECTING');
    if (channel) {
      channel.unsubscribe();
    }
    setupChannel();
  };

  const handleOffline = () => {
    console.log('Browser offline. Realtime disconnected.');
    handlers.onStatusChange('OFFLINE');
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return {
    unsubscribe: () => {
      isUnsubscribed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channel) {
        channel.unsubscribe();
      }
    }
  };
}
