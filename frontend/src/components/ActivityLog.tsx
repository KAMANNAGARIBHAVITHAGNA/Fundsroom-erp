import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Activity, Clock, Package, FileText, Users, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react';

// ─── Event type → colour + icon mapping ─────────────────────────────────────
const EVENT_CFG: Record<string, { color: string; bg: string; border: string; Icon: React.FC<any> }> = {
  'CHALLAN_CREATED':    { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)',  Icon: ShoppingCart },
  'CHALLAN_CONFIRMED':  { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)',  Icon: FileText },
  'CHALLAN_CANCELLED':  { color: 'var(--color-danger)',  bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)',   Icon: AlertCircle },
  'STOCK_ADJUSTED':     { color: 'var(--accent-primary)',bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  Icon: Package },
  'CUSTOMER_CREATED':   { color: 'var(--color-info)',    bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  Icon: Users },
  'PRODUCT_CREATED':    { color: 'var(--accent-primary)',bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  Icon: TrendingUp },
  'NOTE_ADDED':         { color: 'var(--text-secondary)',bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)', Icon: FileText },
};

const getEventCfg = (action: string) => {
  const key = Object.keys(EVENT_CFG).find(k => action?.toUpperCase().includes(k.split('_')[0]) &&
    action?.toUpperCase().includes(k.split('_')[1] ?? ''));
  return EVENT_CFG[key ?? ''] ?? {
    color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', Icon: Activity,
  };
};

const formatTs = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { date, time };
};

// ─── Component ────────────────────────────────────────────────────────────────
const ActivityLog: React.FC = () => {
  const { apiFetch, dataVersion } = useApp();
  const [logs, setLogs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/api/activity');
      setLogs(data.logs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  // ── Re-fetch whenever any module signals activity domain changed ──
  useEffect(() => { loadLogs(); }, [dataVersion.activity]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '760px', margin: '0 auto' }}>
        {/* Skeleton */}
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            display: 'flex', gap: '1rem', padding: '1.1rem 1.25rem',
            background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
            borderRadius: 'var(--radius-md)', animation: `skeleton-pulse 1.6s ${i * 0.15}s ease-in-out infinite alternate`,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ height: 10, width: '30%', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              <div style={{ height: 10, width: '75%', background: 'rgba(255,255,255,0.04)', borderRadius: 4 }} />
            </div>
          </div>
        ))}
        <style>{`@keyframes skeleton-pulse { from{opacity:0.5} to{opacity:1} }`}</style>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--glass-border-l1)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
          AUDIT / LOG LEDGER
        </p>
        <h2 style={{ fontSize: '1.9rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.025em' }}>Activity Timeline</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Immutable audit ledger of all operational events, transactions, and updates.
        </p>
      </header>

      {/* Timeline */}
      <div style={{ maxWidth: '760px' }}>
        {logs.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '4rem 2rem',
            background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
            borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)',
          }}>
            <Activity size={28} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', letterSpacing: '0.08em' }}>NO ACTIVITY LOGGED YET</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>
            {logs.map((log, idx) => {
              const { color, bg, border, Icon } = getEventCfg(log.action);
              const { date, time } = formatTs(log.created_at);
              const isFirst = idx === 0;
              const isLast  = idx === logs.length - 1;

              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    paddingBottom: isLast ? 0 : '0.85rem',
                    transition: 'opacity 0.18s ease',
                    opacity: isFirst ? 1 : 0.8,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = isFirst ? '1' : '0.8'; }}
                >
                  {/* Timeline spine */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
                      background: bg, border: `1px solid ${border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: isFirst ? `0 0 10px ${bg}` : 'none',
                    }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    {!isLast && (
                      <div style={{ width: '1px', flex: 1, background: 'var(--border-subtle)', marginTop: '4px', minHeight: '12px' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{
                    flex: 1, paddingBottom: isLast ? 0 : '0.75rem',
                    padding: '0.1rem 0 0.75rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                        color: isFirst ? color : 'var(--text-muted)',
                      }}>
                        {log.action}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          {date} · {time}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '0.3rem' }}>
                      {log.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Clock size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                        {log.created_by}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLog;
