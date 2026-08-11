import React, { useEffect, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Users, Package, FileCheck2, Clock, CheckCircle, Terminal } from 'lucide-react';

interface Metrics {
  totalProducts: number;
  totalStock: number;
  totalValue: number;
  lowStockCount: number;
  activeCustomers: number;
  todayChallans: number;
  pendingFollowUps: number;
}

// ── Live indicator with relative timestamp ─────────────────────────────────
const LiveIndicator: React.FC<{
  status: 'CONNECTED' | 'CONNECTING' | 'RECONNECTING' | 'OFFLINE';
  lastSyncTime: Date | null;
}> = ({ status, lastSyncTime }) => {
  const [relativeTime, setRelativeTime] = useState('just now');

  useEffect(() => {
    const tick = () => {
      if (!lastSyncTime) { setRelativeTime('—'); return; }
      const secs = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
      if (secs < 10) setRelativeTime('just now');
      else if (secs < 60) setRelativeTime(`${secs}s ago`);
      else setRelativeTime(`${Math.floor(secs / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [lastSyncTime]);

  const config = {
    CONNECTED: {
      color: 'var(--color-success)',
      bg: 'rgba(5,150,105,0.06)',
      border: '1px solid rgba(5,150,105,0.15)',
      dot: '●',
      label: 'LIVE',
      pulse: true
    },
    CONNECTING: {
      color: 'var(--accent-primary)',
      bg: 'rgba(91,92,235,0.06)',
      border: '1px solid rgba(91,92,235,0.15)',
      dot: '◌',
      label: 'CONNECTING',
      pulse: false
    },
    RECONNECTING: {
      color: 'var(--color-warning)',
      bg: 'rgba(217,119,6,0.06)',
      border: '1px solid rgba(217,119,6,0.15)',
      dot: '↻',
      label: 'RECONNECTING',
      pulse: true
    },
    OFFLINE: {
      color: 'var(--text-muted)',
      bg: 'rgba(148,163,184,0.06)',
      border: '1px solid rgba(148,163,184,0.15)',
      dot: '○',
      label: 'OFFLINE',
      pulse: false
    }
  }[status];

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
      padding: '0.25rem 0.65rem',
      background: config.bg,
      border: config.border,
      borderRadius: '5px',
      fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.07em',
    }}>
      <span 
        style={{
          display: 'inline-block',
          color: config.color,
          fontWeight: 700,
          fontSize: '0.75rem',
          lineHeight: 1,
          animation: config.pulse ? 'live-pulse 2.4s ease-in-out infinite' : 'none',
        }}
      >
        {config.dot}
      </span>
      <span style={{ color: config.color, fontWeight: 700 }}>{config.label}</span>
      {status === 'CONNECTED' && (
        <>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>Updated {relativeTime}</span>
        </>
      )}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { user, apiFetch, setCurrentTab, setSelectedIntelProductId, dataVersion, lastSyncTime, realtimeStatus } = useApp();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [draftChallans, setDraftChallans] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const metricsData = await apiFetch('/api/inventory');
      setMetrics(metricsData.metrics);

      // Load Low Stock
      if (['ADMIN', 'WAREHOUSE'].includes(user?.role || '')) {
        const lowStockRes = await apiFetch('/api/inventory/low-stock');
        setLowStock(lowStockRes.products);
      }

      // Load Draft Challans
      const challanRes = await apiFetch('/api/challans');
      setDraftChallans(challanRes.challans.filter((c: any) => c.status === 'Draft'));

      // Load Recent Activities
      const activityRes = await apiFetch('/api/activity');
      setActivities(activityRes.logs.slice(0, 3));
    } catch (error) {
      console.error('Error loading dashboard data', error);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user?.role]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // ── Subscribe to all relevant domains — re-fetch on any change ────────────
  useEffect(() => {
    loadDashboardData();
  }, [
    dataVersion.inventory,
    dataVersion.challans,
    dataVersion.customers,
    dataVersion.activity,
  ]);

  const handleAnalyzeProduct = (prodId: string) => {
    setSelectedIntelProductId(prodId);
    setCurrentTab('intelligence');
  };

  if (loading || !metrics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
          INITIALIZING RADAR SYSTEM...
        </p>
      </div>
    );
  }

  // Calculate operations health
  const lowStockPenal = metrics.lowStockCount * 8;
  const followUpPenal = metrics.pendingFollowUps * 4;
  const operationsHealth = Math.max(50, 100 - lowStockPenal - followUpPenal);

  // Health color mapping
  const getHealthColorClass = (health: number) => {
    if (health > 80) return 'stable';
    if (health > 60) return 'warning';
    return 'critical';
  };

  // Convert health percentage to segments active (1 to 10)
  const activeSegments = Math.round(operationsHealth / 10);

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Editorial Header */}
      <header style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--glass-border-l1)', paddingBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="signal-pulse"></span>
            <p style={{ textTransform: 'uppercase', color: 'var(--accent-primary)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em' }}>
              SYSTEM ONLINE
            </p>
          </div>
          <LiveIndicator status={realtimeStatus} lastSyncTime={lastSyncTime} />
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0.25rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
          GOOD MORNING, {user?.full_name.toUpperCase()}.
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Operations Control Center • Active Session
        </p>
      </header>

      {/* Futuristic Metric Strip Grid */}
      <div className="metric-strip-grid">
        
        <div className="metric-strip-block" onClick={() => setCurrentTab('crm')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="metric-strip-label">Active Customers</span>
              <Users size={14} style={{ color: 'var(--accent-secondary)' }} />
            </div>
            <div className="metric-strip-value">
              {String(metrics.activeCustomers).padStart(2, '0')}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Relationships →
          </span>
        </div>

        <div className="metric-strip-block" onClick={() => setCurrentTab('inventory')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="metric-strip-label">Total SKUs</span>
              <Package size={14} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div className="metric-strip-value">
              {String(metrics.totalProducts).padStart(2, '0')}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Open Ledger →
          </span>
        </div>

        <div className="metric-strip-block" onClick={() => setCurrentTab('inventory')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="metric-strip-label">Stock Units</span>
              <Package size={14} style={{ color: 'var(--color-success)' }} />
            </div>
            <div className="metric-strip-value" style={{ fontSize: '2rem' }}>
              {metrics.totalStock.toLocaleString()}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Review stock →
          </span>
        </div>

        <div className="metric-strip-block" onClick={() => setCurrentTab('challans')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="metric-strip-label">Today's Challans</span>
              <FileCheck2 size={14} style={{ color: 'var(--color-warning)' }} />
            </div>
            <div className="metric-strip-value">
              {String(metrics.todayChallans).padStart(2, '0')}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-warning)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Track logs →
          </span>
        </div>

        <div className="metric-strip-block" onClick={() => setCurrentTab('crm')}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span className="metric-strip-label">Follow-ups Due</span>
              <Clock size={14} style={{ color: 'var(--color-critical)' }} />
            </div>
            <div className="metric-strip-value">
              {String(metrics.pendingFollowUps).padStart(2, '0')}
            </div>
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--color-critical)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            Due tasks →
          </span>
        </div>

      </div>

      {/* OPERATIONS SIGNAL Ticker Panel */}
      <div className="technical-section-label">
        <Terminal size={12} /> / OPERATIONS SIGNAL
      </div>
      <div className="operations-signal-strip">
        <div className="signal-item">
          <span className="signal-pulse"></span>
          <span>LOW STOCK ASSIGNMENT:</span>
          <strong>{metrics.lowStockCount > 0 ? `${metrics.lowStockCount} PRODUCTS` : 'STABLE'}</strong>
        </div>
        <div className="signal-item">
          <span className="signal-pulse" style={{ backgroundColor: 'var(--color-warning)' }}></span>
          <span>PENDING DRAFTS:</span>
          <strong>{draftChallans.length} IN QUEUE</strong>
        </div>
        <div className="signal-item">
          <span className="signal-pulse" style={{ backgroundColor: 'var(--color-critical)' }}></span>
          <span>PENDING FOLLOW-UPS:</span>
          <strong>{metrics.pendingFollowUps} DUE</strong>
        </div>
        <div className="signal-item">
          <span className="signal-pulse" style={{ backgroundColor: 'var(--accent-secondary)' }}></span>
          <span>INTELLIGENCE SCORE:</span>
          <strong>{operationsHealth}% OPTIMAL</strong>
        </div>
      </div>

      {/* Main Workspace Composition (Asymmetric Grid) */}
      <div className="asymmetric-layout-grid">
        
        {/* Left Column: Operations Health & Activity Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div>
            <div className="technical-section-label">/ OPERATIONS HEALTH</div>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="health-container" style={{ position: 'relative' }}>
                {/* Animated pulse ring behind the number */}
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -60%)',
                  width: '140px', height: '140px', borderRadius: '50%',
                  border: `1px solid ${
                    operationsHealth > 80 ? 'rgba(16,185,129,0.18)'
                    : operationsHealth > 60 ? 'rgba(245,158,11,0.18)'
                    : 'rgba(239,68,68,0.18)'
                  }`,
                  animation: 'pulse-ring 3s ease-in-out infinite',
                  pointerEvents: 'none',
                }} />
                <span className="health-label-percentage" style={{ position: 'relative', zIndex: 1 }}>
                  {operationsHealth}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', position: 'relative', zIndex: 1 }}>SYSTEM OPERATIONAL METRIC</span>
                
                <div className="segmented-health-bar">
                  {[...Array(10)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`health-segment ${i < activeSegments ? 'active' : ''} ${i < activeSegments ? getHealthColorClass(operationsHealth) : ''}`}
                      style={i < activeSegments ? {
                        boxShadow: `0 0 4px ${
                          operationsHealth > 80 ? 'rgba(16,185,129,0.5)'
                          : operationsHealth > 60 ? 'rgba(245,158,11,0.5)'
                          : 'rgba(239,68,68,0.5)'
                        }`
                      } : {}}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                {[
                  {
                    label: 'Inventory Status',
                    tab: 'inventory',
                    badge: metrics.lowStockCount > 0 ? `${metrics.lowStockCount} LOW SKU` : 'STABLE',
                    bClass: metrics.lowStockCount > 0 ? 'attention' : 'stable',
                  },
                  {
                    label: 'CRM Activity',
                    tab: 'crm',
                    badge: metrics.pendingFollowUps > 0 ? 'ATTENTION' : 'STABLE',
                    bClass: metrics.pendingFollowUps > 0 ? 'attention' : 'stable',
                  },
                  {
                    label: 'Sales Pipeline',
                    tab: 'challans',
                    badge: draftChallans.length > 0 ? `${draftChallans.length} PENDING` : 'STABLE',
                    bClass: draftChallans.length > 0 ? 'attention' : 'stable',
                  },
                  {
                    label: 'Follow-ups Queue',
                    tab: 'crm',
                    badge: metrics.pendingFollowUps > 0 ? `${metrics.pendingFollowUps} DUE` : 'CLEAR',
                    bClass: metrics.pendingFollowUps > 0 ? 'high' : 'stable',
                  },
                ].map(row => (
                  <div
                    key={row.label}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '0.35rem 0', transition: 'opacity 0.18s' }}
                    onClick={() => setCurrentTab(row.tab as any)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.75'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{row.label}</span>
                    <span className={`status-pill ${row.bClass}`} style={{ fontSize: '0.6rem', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                      {row.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity Section */}
          <div>
            <div className="technical-section-label">/ SYSTEM ACTIVITY</div>
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
              {activities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {activities.map((act, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === activities.length - 1;
                    return (
                      <div
                        key={act.id}
                        style={{
                          display: 'flex', gap: '0.9rem', paddingBottom: isLast ? 0 : '1rem',
                          opacity: isFirst ? 1 : 0.72,
                          transition: 'opacity 0.2s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = isFirst ? '1' : '0.72'; }}
                      >
                        {/* Spine */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{
                            width: isFirst ? '8px' : '6px',
                            height: isFirst ? '8px' : '6px',
                            borderRadius: '50%',
                            background: isFirst ? 'var(--accent-primary)' : 'var(--text-muted)',
                            flexShrink: 0, marginTop: '3px',
                            boxShadow: isFirst ? '0 0 6px var(--accent-primary)' : 'none',
                          }} />
                          {!isLast && <div style={{ width: '1px', flex: 1, background: 'var(--border-subtle)', marginTop: '4px' }} />}
                        </div>
                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                              color: isFirst ? 'var(--accent-primary)' : 'var(--text-muted)',
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>
                              {act.action}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.2rem' }}>
                            {act.description}
                          </p>
                          {act.performed_by && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              {act.performed_by}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', textAlign: 'center', padding: '1rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>NO RECENT ACTIVITY</p>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Needs Attention Incident Console */}
        <div>
          <div className="technical-section-label">/ NEEDS ATTENTION</div>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minHeight: '380px' }}>
            
            <div className="incident-feed">
              
              {/* Low Stock Alerts */}
              {['ADMIN', 'WAREHOUSE'].includes(user?.role || '') && lowStock.slice(0, 2).map((item) => (
                <div
                  key={item.id}
                  className="incident-card"
                  style={{
                    borderLeft: '3px solid var(--color-critical)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(239,68,68,0.12)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  <div className="incident-header">
                    <span className="incident-priority critical">CRITICAL</span>
                    <ShieldAlert size={13} style={{ color: 'var(--color-critical)' }} />
                  </div>
                  <div className="incident-title">{item.name}</div>
                  <div className="incident-desc">
                    Stock level is at {item.current_stock} units. Safety target requires {item.minimum_stock} units.
                  </div>
                  <button className="incident-action" onClick={() => handleAnalyzeProduct(item.id)}>
                    ANALYZE SYSTEM IMPACT →
                  </button>
                </div>
              ))}

              {/* Draft Challan Alerts */}
              {['ADMIN', 'SALES'].includes(user?.role || '') && draftChallans.slice(0, 2).map((challan) => (
                <div
                  key={challan.id}
                  className="incident-card"
                  style={{
                    borderLeft: '3px solid var(--color-warning)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(245,158,11,0.1)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  <div className="incident-header">
                    <span className="incident-priority medium">PENDING</span>
                    <Clock size={13} style={{ color: 'var(--color-warning)' }} />
                  </div>
                  <div className="incident-title">{challan.challan_number}</div>
                  <div className="incident-desc">
                    Draft order for {challan.customer_name} requires stock validation and confirmation.
                  </div>
                  <button className="incident-action" onClick={() => setCurrentTab('challans')}>
                    PROCESS CONFIRMATION →
                  </button>
                </div>
              ))}

              {/* Empty state */}
              {lowStock.length === 0 && draftChallans.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <CheckCircle size={26} style={{ color: 'var(--color-success)', marginBottom: '0.5rem' }} />
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>OPERATIONS HEALTH OPTIMAL</p>
                  <p style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>All system logs and stock levels meet standard safety coefficients.</p>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
