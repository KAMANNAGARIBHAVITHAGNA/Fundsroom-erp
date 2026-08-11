import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BrainCircuit, Info, Sparkles, Calculator, AlertTriangle, CheckCircle, X } from 'lucide-react';

// ─── Risk colour helpers ────────────────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  LOW: 'var(--color-success)',
  MEDIUM: 'var(--color-warning)',
  HIGH: 'var(--color-danger)',
  CRITICAL: 'var(--color-critical)',
};

const RISK_BG: Record<string, string> = {
  LOW: 'rgba(16,185,129,0.06)',
  MEDIUM: 'rgba(245,158,11,0.06)',
  HIGH: 'rgba(239,68,68,0.06)',
  CRITICAL: 'rgba(236,72,153,0.07)',
};

const RISK_BORDER: Record<string, string> = {
  LOW: 'rgba(16,185,129,0.2)',
  MEDIUM: 'rgba(245,158,11,0.2)',
  HIGH: 'rgba(239,68,68,0.22)',
  CRITICAL: 'rgba(236,72,153,0.25)',
};

// ─── Stock-level mini bar ───────────────────────────────────────────────────
const StockBar: React.FC<{ current: number; minimum: number; riskLevel: string }> = ({
  current, minimum, riskLevel,
}) => {
  const max = Math.max(current, minimum) * 1.2 || 1;
  const pct = Math.min(100, (current / max) * 100);
  const color = RISK_COLORS[riskLevel] ?? 'var(--accent-primary)';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STOCK LEVEL</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>{current} / {minimum} min</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
        {/* Safety threshold marker */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${Math.min(100, (minimum / max) * 100)}%`,
          width: '2px', background: 'rgba(255,255,255,0.25)',
        }} />
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: '3px', transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: `0 0 6px ${color}55`,
        }} />
      </div>
    </div>
  );
};

// ─── Confidence badge ───────────────────────────────────────────────────────
const ConfBadge: React.FC<{ score: number; label: string }> = ({ score, label }) => {
  const color = score >= 90 ? 'var(--color-success)'
    : score >= 80 ? 'var(--accent-primary)'
    : score >= 65 ? 'var(--color-warning)'
    : 'var(--text-muted)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
      color, letterSpacing: '0.06em',
    }}>
      {score}% · {label}
    </span>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
const Intelligence: React.FC = () => {
  const { apiFetch, selectedIntelProductId, setSelectedIntelProductId, dataVersion } = useApp();
  const [risks, setRisks] = useState<any[]>([]);
  const [draftChallans, setDraftChallans] = useState<any[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Simulation State — all preserved exactly as before
  const [selectedChallanIds, setSelectedChallanIds] = useState<string[]>([]);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const riskData = await apiFetch('/api/intelligence/inventory-risks');
      setRisks(riskData.risks);

      const challanData = await apiFetch('/api/challans');
      setDraftChallans(challanData.challans.filter((c: any) => c.status === 'Draft'));

      if (selectedIntelProductId) {
        const matchingRisk = riskData.risks.find((r: any) => r.productId === selectedIntelProductId);
        if (matchingRisk) setSelectedRisk(matchingRisk);
        setSelectedIntelProductId(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedIntelProductId]);

  // ── Re-fetch risk data when inventory changes (stock adjust or challan confirm) ──
  useEffect(() => {
    if (!loading) loadData();
  }, [dataVersion.inventory]);

  const handleSimulate = async () => {
    if (selectedChallanIds.length === 0) return;
    setSimulating(true);
    try {
      const data = await apiFetch('/api/intelligence/simulate', {
        method: 'POST',
        body: JSON.stringify({ challan_ids: selectedChallanIds }),
      });
      setSimulationResult(data.simulation);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSimulating(false);
    }
  };

  const toggleChallanSelect = (id: string) => {
    setSelectedChallanIds(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  // ── Derived overview stats ──────────────────────────────────────────────
  const criticalCount   = risks.filter(r => r.riskLevel === 'CRITICAL').length;
  const highCount       = risks.filter(r => r.riskLevel === 'HIGH').length;
  const stockoutCount   = risks.filter(r => r.projectedStockoutDays !== 999).length;

  // ── Simulation status label ─────────────────────────────────────────────
  const simStatus = simulationResult ? 'RESULTS AVAILABLE' : simulating ? 'RUNNING' : 'READY';
  const simStatusColor = simulationResult ? 'var(--color-warning)' : simulating ? 'var(--accent-primary)' : 'var(--text-muted)';

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '60vh', gap: '0.75rem' }}>
        <BrainCircuit size={28} style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
        <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
          GATHERING INVENTORY PATTERNS...
        </p>
      </div>
    );
  }

  return (
    <div>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header style={{ marginBottom: '1.75rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--glass-border-l1)' }}>
        <p style={{ textTransform: 'uppercase', color: 'var(--accent-primary)', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
          Intelligence Module
        </p>
        <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 0.3rem', letterSpacing: '-0.02em' }}>
          Operations Intelligence Engine
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Predictive safety scoring, explainability, and demand simulations.
        </p>
      </header>

      {/* ── Intelligence Overview Strip ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2rem',
        background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
        backdropFilter: 'var(--glass-blur-l1)', borderRadius: '8px',
        padding: '0.75rem 1.5rem', marginBottom: '2rem', overflowX: 'auto',
        scrollbarWidth: 'none', whiteSpace: 'nowrap',
      }}>
        {[
          { label: 'PRODUCTS MONITORED', value: String(risks.length).padStart(2, '0'), color: 'var(--text-primary)' },
          { label: 'CRITICAL', value: String(criticalCount).padStart(2, '0'), color: 'var(--color-critical)' },
          { label: 'HIGH RISK', value: String(highCount).padStart(2, '0'), color: 'var(--color-danger)' },
          { label: 'PROJECTED STOCKOUTS', value: String(stockoutCount).padStart(2, '0'), color: 'var(--color-warning)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.35rem', color: item.color, lineHeight: 1 }}>
              {item.value}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {item.label}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: simStatusColor, display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: simStatusColor, letterSpacing: '0.1em' }}>
            SIMULATION {simStatus}
          </span>
        </div>
      </div>

      {/* ── Main two-column grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Risk Forecast ──────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
            <BrainCircuit size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }}>
              Inventory Safety &amp; Risk Forecast
            </h3>
          </div>

          {risks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <CheckCircle size={28} style={{ color: 'var(--color-success)', marginBottom: '0.5rem' }} />
              <p>No products are currently at risk. All stock levels are stable.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {risks.map((risk) => (
                <div
                  key={risk.productId}
                  style={{
                    padding: '1.1rem 1.25rem',
                    background: RISK_BG[risk.riskLevel] ?? 'rgba(255,255,255,0.02)',
                    border: `1px solid ${RISK_BORDER[risk.riskLevel] ?? 'var(--border-subtle)'}`,
                    borderRadius: '10px',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${RISK_BORDER[risk.riskLevel] ?? 'transparent'}`;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = '';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                  }}
                >
                  {/* Card top row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.15rem' }}>{risk.productName}</h4>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                        SKU: {risk.sku}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                      <span className={`status-pill ${risk.riskLevel.toLowerCase()}`}>{risk.riskLevel}</span>
                      <ConfBadge score={risk.confidence} label={risk.confidenceLabel} />
                    </div>
                  </div>

                  {/* Stock metrics row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'block', marginBottom: '0.15rem' }}>
                        CURRENT STOCK
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: RISK_COLORS[risk.riskLevel] ?? 'var(--text-primary)' }}>
                        {risk.currentStock}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>units</span>
                    </div>
                    <div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'block', marginBottom: '0.15rem' }}>
                        SAFETY TARGET
                      </span>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {risk.minimumStock}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.3rem' }}>units</span>
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div style={{ marginBottom: '0.85rem' }}>
                    <StockBar current={risk.currentStock} minimum={risk.minimumStock} riskLevel={risk.riskLevel} />
                  </div>

                  {/* Bottom row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {risk.projectedStockoutDays === 999
                        ? '● STABLE'
                        : `⚠ STOCKOUT ~${risk.projectedStockoutDays}d`}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', gap: '0.35rem' }}
                      onClick={() => setSelectedRisk(risk)}
                    >
                      <Info size={13} /> WHY?
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: What-If Simulator ─────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Simulator header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
              <Sparkles size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>What-If Simulator</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.5 }}>
              Model inventory impact before approving pending challans.
            </p>
          </div>

          {/* Simulation mode status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.55rem 0.85rem',
            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: simStatusColor, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              SIMULATION MODE · {simStatus}
            </span>
          </div>

          {/* Draft challan selector */}
          {draftChallans.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <Calculator size={22} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
              <p>No pending draft challans to simulate.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {draftChallans.map((ch) => (
                  <label
                    key={ch.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.75rem 0.9rem',
                      background: selectedChallanIds.includes(ch.id) ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                      border: selectedChallanIds.includes(ch.id) ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-subtle)',
                      borderRadius: '8px', cursor: 'pointer',
                      transition: 'border-color 0.18s, background 0.18s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChallanIds.includes(ch.id)}
                      onChange={() => toggleChallanSelect(ch.id)}
                    />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ch.challan_number}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
                        {ch.customer_name} · {ch.total_quantity} units
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', gap: '0.5rem' }}
                onClick={handleSimulate}
                disabled={selectedChallanIds.length === 0 || simulating}
              >
                <Calculator size={15} />
                {simulating ? 'Simulating...' : 'Simulate Demand Impact'}
              </button>
            </>
          )}

          {/* ── Simulation results ────────────────────────────────────── */}
          {simulationResult && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--color-warning)' }}>
                  SIMULATION RESULTS
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    {simulationResult.affectedProductsCount} affected
                  </span>
                  {simulationResult.newRisksCount > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--color-danger)' }}>
                      {simulationResult.newRisksCount} new risks
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {simulationResult.affectedProducts.map((p: any) => {
                  const deficit = p.projectedStock < 0;
                  const breach  = !deficit && p.projectedStock < (risks.find((r: any) => r.productId === p.productId)?.minimumStock ?? 0);
                  const statusLabel = deficit ? 'PROJECTED DEFICIT' : breach ? 'PROJECTED SAFETY BREACH' : 'PROJECTED STOCKOUT';
                  const statusColor = deficit ? 'var(--color-critical)' : breach ? 'var(--color-danger)' : 'var(--color-warning)';

                  return (
                    <div
                      key={p.productId}
                      style={{
                        padding: '0.9rem 1rem',
                        background: RISK_BG[p.projectedRisk] ?? 'rgba(255,255,255,0.02)',
                        border: `1px solid ${RISK_BORDER[p.projectedRisk] ?? 'var(--border-subtle)'}`,
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.productName}</span>
                        <span className={`status-pill ${p.projectedRisk.toLowerCase()}`}>{p.projectedRisk}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.65rem' }}>
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block' }}>CURRENT</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                            {p.originalStock}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>units</span>
                        </div>
                        <div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.07em', display: 'block' }}>PROJECTED</span>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', color: RISK_COLORS[p.projectedRisk] ?? 'var(--text-primary)' }}>
                            {p.projectedStock}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>units</span>
                        </div>
                      </div>

                      {(deficit || breach) && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.35rem 0.6rem',
                          background: `${statusColor}18`,
                          border: `1px solid ${statusColor}30`,
                          borderRadius: '5px',
                        }}>
                          <AlertTriangle size={11} style={{ color: statusColor, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: statusColor, letterSpacing: '0.07em' }}>
                            {statusLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── WHY Explanation Modal ─────────────────────────────────────────── */}
      {selectedRisk && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedRisk(null); }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '520px', width: '100%',
              maxHeight: '90vh', overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: '1.25rem',
              padding: '1.75rem',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
                  EXPLAINABILITY REPORT
                </p>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.3 }}>
                  WHY IS {selectedRisk.productName.toUpperCase()} CLASSIFIED AS {selectedRisk.riskLevel}?
                </h3>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--accent-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  {selectedRisk.productName} · SKU: {selectedRisk.sku}
                </span>
              </div>
              <button
                onClick={() => setSelectedRisk(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Risk + Confidence badges */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`status-pill ${selectedRisk.riskLevel.toLowerCase()}`}>{selectedRisk.riskLevel} RISK</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                padding: '0.2rem 0.6rem',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-subtle)', borderRadius: '4px',
                color: 'var(--text-secondary)',
              }}>
                {selectedRisk.confidence}% · {selectedRisk.confidenceLabel}
              </span>
            </div>

            {/* Metrics grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem',
            }}>
              {[
                { label: 'CURRENT STOCK', value: `${selectedRisk.currentStock} units` },
                { label: 'SAFETY TARGET', value: `${selectedRisk.minimumStock} units` },
                { label: '7-DAY OUTFLOW', value: `${selectedRisk.outflowVelocity7d} units` },
                {
                  label: 'PROJECTED STOCKOUT',
                  value: selectedRisk.projectedStockoutDays === 999 ? 'Stable' : `~${selectedRisk.projectedStockoutDays} days`,
                },
              ].map(m => (
                <div
                  key={m.label}
                  style={{
                    padding: '0.75rem', background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)', borderRadius: '8px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em', display: 'block', marginBottom: '0.3rem' }}>
                    {m.label}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{m.value}</span>
                </div>
              ))}
            </div>

            {/* Why this matters */}
            <div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.6rem' }}>
                WHY THIS MATTERS
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedRisk.reasons.map((r: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem' }}>
                    <span style={{ color: RISK_COLORS[selectedRisk.riskLevel] ?? 'var(--accent-primary)', marginTop: '1px', flexShrink: 0 }}>▸</span>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Confidence evidence block */}
            <div style={{
              background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.14)',
              borderRadius: '8px', padding: '0.85rem 1rem',
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                CONFIDENCE
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                {selectedRisk.confidence}% · {selectedRisk.confidenceLabel}
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Evidence: {selectedRisk.movementCount > 0
                  ? `${selectedRisk.movementCount} historical stock movement${selectedRisk.movementCount > 1 ? 's' : ''} analysed. ${selectedRisk.confidenceEvidence}`
                  : selectedRisk.confidenceEvidence}
              </p>
            </div>

            {/* Recommended action */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                RECOMMENDED ACTION
              </p>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-warning)', lineHeight: 1.5 }}>
                {selectedRisk.recommendedAction}
              </p>
            </div>

            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '0.25rem' }}
              onClick={() => setSelectedRisk(null)}
            >
              Close Explanation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Intelligence;
