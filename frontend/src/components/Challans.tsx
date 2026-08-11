import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus, Check, X, AlertCircle, ShoppingCart, Trash2, ArrowLeft, Search, FileText, Users,
} from 'lucide-react';

// ─── Tiny helper: status colour maps ───────────────────────────────────────
const STATUS_BG: Record<string, string> = {
  draft:      'rgba(245,158,11,0.08)',
  confirmed:  'rgba(16,185,129,0.08)',
  cancelled:  'rgba(107,114,128,0.08)',
};
const STATUS_BORDER: Record<string, string> = {
  draft:      'rgba(245,158,11,0.22)',
  confirmed:  'rgba(16,185,129,0.22)',
  cancelled:  'rgba(107,114,128,0.22)',
};
const STATUS_COLOR: Record<string, string> = {
  draft:      'var(--color-warning)',
  confirmed:  'var(--color-success)',
  cancelled:  'var(--text-muted)',
};

// ─── Step indicator ─────────────────────────────────────────────────────────
const StepIndicator: React.FC<{ step: number }> = ({ step }) => {
  const steps = [
    { n: 1, label: 'CUSTOMER' },
    { n: 2, label: 'PRODUCTS' },
    { n: 3, label: 'REVIEW' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem' }}>
      {steps.map((s, idx) => {
        const active = step >= s.n;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                background: active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.06)',
                color: active ? '#fff' : 'var(--text-muted)',
                transition: 'background 0.2s',
              }}>{String(s.n).padStart(2, '0')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.08em', color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: '1px', background: step > s.n ? 'var(--accent-primary)' : 'var(--border-subtle)', transition: 'background 0.2s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─── Confirmation dialog ─────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{
  challanNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ challanNumber, onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
  }}>
    <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <AlertCircle size={20} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-warning)', letterSpacing: '0.1em' }}>
          CONFIRM SALES CHALLAN
        </span>
      </div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.6rem' }}>{challanNumber}</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
        This will <strong style={{ color: 'var(--text-primary)' }}>deduct the listed quantities from inventory</strong>.
        This action cannot be undone without cancelling the challan.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" style={{ flex: 2, gap: '0.5rem' }} onClick={onConfirm}>
          <Check size={15} /> Confirm &amp; Deduct Stock
        </button>
      </div>
    </div>
  </div>
);

// ─── Main component ─────────────────────────────────────────────────────────
const Challans: React.FC = () => {
  const { user, apiFetch, signalDataChange, dataVersion } = useApp();

  // All existing state — preserved exactly
  const [challans, setChallans]           = useState<any[]>([]);
  const [customers, setCustomers]         = useState<any[]>([]);
  const [products, setProducts]           = useState<any[]>([]);
  const [selectedChallanId, setSelectedChallanId] = useState<string | null>(null);
  const [selectedChallan, setSelectedChallan]     = useState<any>(null);
  const [showAddForm, setShowAddForm]     = useState(false);

  // New Challan Form State
  const [customerId, setCustomerId]           = useState('');
  const [notes, setNotes]                     = useState('');
  const [selectedItems, setSelectedItems]     = useState<{ product_id: string; quantity: number }[]>([]);
  const [currentProductId, setCurrentProductId] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState(1);

  // Status/Feedback
  const [errorFeedback, setErrorFeedback]   = useState<{ message: string; details?: any } | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // UI-only: inline confirm dialog
  const [confirmingChallan, setConfirmingChallan] = useState<{ id: string; number: string } | null>(null);

  // UI-only: ledger filters
  const [ledgerSearch, setLedgerSearch]     = useState('');
  const [statusFilter, setStatusFilter]     = useState<'all' | 'draft' | 'confirmed'>('all');

  // ── All existing data-loading ─────────────────────────────────────────
  const loadChallans = async () => {
    try {
      const data = await apiFetch('/api/challans');
      setChallans(data.challans);
    } catch (error) { console.error(error); }
  };

  const loadFormHelpers = async () => {
    try {
      const custData = await apiFetch('/api/customers');
      setCustomers(custData.customers);
      const prodData = await apiFetch('/api/products');
      setProducts(prodData.products);
    } catch (error) { console.error(error); }
  };

  const loadChallanDetail = async (id: string) => {
    try {
      const data = await apiFetch(`/api/challans/${id}`);
      setSelectedChallan(data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    loadChallans();
    loadFormHelpers();
  }, []);

  // ── Re-fetch if another module triggers a challans update ──
  useEffect(() => { loadChallans(); }, [dataVersion.challans]);

  useEffect(() => {
    if (selectedChallanId) {
      loadChallanDetail(selectedChallanId);
    } else {
      setSelectedChallan(null);
    }
  }, [selectedChallanId]);

  // ── All existing handlers — preserved exactly ────────────────────────
  const handleAddItem = () => {
    if (!currentProductId || currentQuantity <= 0) return;
    const existingIdx = selectedItems.findIndex(i => i.product_id === currentProductId);
    if (existingIdx > -1) {
      const updated = [...selectedItems];
      updated[existingIdx].quantity += currentQuantity;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, { product_id: currentProductId, quantity: currentQuantity }]);
    }
    setCurrentProductId('');
    setCurrentQuantity(1);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFeedback(null);
    if (selectedItems.length === 0) {
      alert('Add at least one product item.');
      return;
    }
    try {
      await apiFetch('/api/challans', {
        method: 'POST',
        body: JSON.stringify({ customer_id: customerId, notes, items: selectedItems }),
      });
      setShowAddForm(false);
      resetForm();
      loadChallans();
      signalDataChange('challans', 'activity');
    } catch (error: any) {
      setErrorFeedback({ message: error.message });
    }
  };

  const handleConfirmChallan = async (challanId: string, challanNumber: string) => {
    setErrorFeedback(null);
    setSuccessFeedback(null);
    setConfirmingChallan(null);
    try {
      await apiFetch(`/api/challans/${challanId}/confirm`, { method: 'POST' });
      setSuccessFeedback(`CHALLAN CONFIRMED: ${challanNumber}. Inventory synchronized.`);
      loadChallans();
      if (selectedChallanId === challanId) loadChallanDetail(challanId);
      // Confirmation deducts inventory — signal both challans and inventory domains
      signalDataChange('challans', 'inventory', 'activity');
    } catch (error: any) {
      setErrorFeedback({ message: error.message, details: error.details || null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCancelChallan = async (challanId: string) => {
    if (!confirm('Are you sure you want to cancel this challan? Confirmed stock deductions will be reversed.')) return;
    setErrorFeedback(null);
    setSuccessFeedback(null);
    try {
      await apiFetch(`/api/challans/${challanId}/cancel`, { method: 'POST' });
      setSuccessFeedback('Challan cancelled successfully.');
      loadChallans();
      if (selectedChallanId === challanId) loadChallanDetail(challanId);
      signalDataChange('challans', 'activity');
    } catch (error: any) {
      setErrorFeedback({ message: error.message });
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setNotes('');
    setSelectedItems([]);
    setCurrentProductId('');
    setCurrentQuantity(1);
  };

  const showActions = ['ADMIN', 'SALES'].includes(user?.role || '');

  // ── Derived stats (real data) ──────────────────────────────────────────
  const draftCount     = challans.filter(c => c.status === 'Draft').length;
  const confirmedCount = challans.filter(c => c.status === 'Confirmed').length;
  const totalValue     = challans.reduce((a, c) => a + parseFloat(c.total_amount || 0), 0);

  // ── Create form derived values ─────────────────────────────────────────
  const selectedCustomer = customers.find(c => c.id === customerId);
  const liveTotalQty     = selectedItems.reduce((a, i) => a + i.quantity, 0);
  const liveTotalValue   = selectedItems.reduce((a, i) => {
    const prod = products.find(p => p.id === i.product_id);
    return a + (parseFloat(prod?.unit_price || 0) * i.quantity);
  }, 0);

  // Step state: 1 = no customer, 2 = customer selected, 3 = has items
  const currentStep = !customerId ? 1 : selectedItems.length === 0 ? 2 : 3;

  // ── Ledger filter (client-side) ────────────────────────────────────────
  const filteredChallans = useMemo(() => {
    let list = challans;
    if (statusFilter !== 'all') list = list.filter(c => c.status.toLowerCase() === statusFilter);
    if (ledgerSearch.trim()) {
      const q = ledgerSearch.toLowerCase();
      list = list.filter(c =>
        c.challan_number.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [challans, statusFilter, ledgerSearch]);

  // ── Filter pill helper ─────────────────────────────────────────────────
  const fPill = (active: boolean) => ({
    padding: '0.2rem 0.75rem',
    borderRadius: '4px',
    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
    background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)' as const,
    fontSize: '0.68rem',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'all 0.18s',
  });

  // ═══════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedChallan) {
    const ch = selectedChallan.challan;
    const sk = ch.status.toLowerCase();
    return (
      <div>
        {/* Confirm dialog overlay */}
        {confirmingChallan && (
          <ConfirmDialog
            challanNumber={confirmingChallan.number}
            onConfirm={() => handleConfirmChallan(confirmingChallan.id, confirmingChallan.number)}
            onCancel={() => setConfirmingChallan(null)}
          />
        )}

        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setSelectedChallanId(null)}>
          <ArrowLeft size={15} /> Back to Challans
        </button>

        {/* Feedback banners */}
        {errorFeedback && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--color-danger)' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              <AlertCircle size={16} /> INSUFFICIENT STOCK
            </h4>
            <p style={{ fontSize: '0.85rem' }}>{errorFeedback.message} Nothing was changed.</p>
            {errorFeedback.details && (
              <p style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', marginTop: '0.4rem' }}>
                Requested: {errorFeedback.details.requested} · Available: {errorFeedback.details.available}
              </p>
            )}
          </div>
        )}
        {successFeedback && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--color-success)', fontWeight: 600, fontSize: '0.88rem' }}>
            {successFeedback}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* LEFT — challan detail */}
          <div className="glass-card" style={{ padding: '1.75rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: '0.4rem' }}>
                  SALES CHALLAN
                </p>
                <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '1.8rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {ch.challan_number}
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
                  fontWeight: 700, padding: '0.3rem 0.8rem', borderRadius: '5px', letterSpacing: '0.08em',
                  background: STATUS_BG[sk] ?? 'transparent',
                  border: `1px solid ${STATUS_BORDER[sk] ?? 'var(--border-subtle)'}`,
                  color: STATUS_COLOR[sk] ?? 'var(--text-muted)',
                }}>
                  {ch.status.toUpperCase()}
                </span>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {new Date(ch.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            {/* Customer strip */}
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: '7px', marginBottom: '1.5rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>CUSTOMER</p>
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ch.customer_name}</p>
              {ch.customer_business_name && (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{ch.customer_business_name}</p>
              )}
            </div>

            {/* Line items table */}
            <div className="table-container" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: '400px' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedChallan.items.map((item: any) => (
                    <tr key={item.id}>
                      <td><span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.product_name_snapshot}</span></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.sku_snapshot}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>₹{parseFloat(item.unit_price_snapshot).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)' }}>₹{parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>TOTAL QUANTITY</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem' }}>{ch.total_quantity} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>units</span></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>GRAND TOTAL</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.4rem', color: 'var(--accent-primary)' }}>₹{parseFloat(ch.total_amount).toFixed(2)}</p>
              </div>
            </div>

            {/* Notes */}
            {ch.notes && (
              <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>INTERNAL NOTE</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{ch.notes}</p>
              </div>
            )}

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                Created by <span style={{ color: 'var(--text-secondary)' }}>{ch.created_by}</span>
              </p>
            </div>
          </div>

          {/* RIGHT — actions panel */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>CHALLAN ACTIONS</p>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.4rem' }}>Manage Transaction</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Control the state of this business transaction.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {ch.status === 'Draft' && showActions && (
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', gap: '0.5rem' }}
                  onClick={() => setConfirmingChallan({ id: ch.id, number: ch.challan_number })}
                >
                  <Check size={15} /> Confirm Challan
                </button>
              )}
              {ch.status === 'Confirmed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '7px' }}>
                  <Check size={15} style={{ color: 'var(--color-success)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-success)' }}>INVENTORY SYNCHRONIZED</span>
                </div>
              )}
              {ch.status !== 'Cancelled' && showActions && (
                <button className="btn btn-danger" style={{ width: '100%', gap: '0.5rem' }} onClick={() => handleCancelChallan(ch.id)}>
                  <X size={15} /> Cancel Challan
                </button>
              )}
              {ch.status === 'Cancelled' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)', borderRadius: '7px' }}>
                  <X size={15} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>CHALLAN CANCELLED</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CREATE FORM
  // ═══════════════════════════════════════════════════════════════════════
  if (showAddForm) {
    return (
      <div>
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => { setShowAddForm(false); resetForm(); }}>
          <ArrowLeft size={15} /> Back to Challans
        </button>

        {/* Page header */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--glass-border-l1)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
            TRANSACTION WORKSPACE
          </p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
            Create Sales Challan
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Draft transaction · No inventory is deducted until confirmation.
          </p>
        </div>

        <StepIndicator step={currentStep} />

        {errorFeedback && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--color-danger)', fontSize: '0.88rem' }}>
            {errorFeedback.message}
          </div>
        )}

        <form onSubmit={handleCreateDraft}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>

            {/* ── LEFT COLUMN ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* CUSTOMER section */}
              <div style={{ padding: '1.25rem 1.5rem', background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)', backdropFilter: 'var(--glass-blur-l1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Users size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                    CUSTOMER
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: selectedCustomer ? '1rem' : 0 }}>
                  <select className="form-select" value={customerId} onChange={e => setCustomerId(e.target.value)} required>
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.business_name || 'Individual'})</option>
                    ))}
                  </select>
                </div>

                {/* Customer preview */}
                {selectedCustomer && (
                  <div style={{ padding: '0.7rem 0.9rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '7px' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.1rem' }}>{selectedCustomer.name}</p>
                    {selectedCustomer.business_name && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{selectedCustomer.business_name}</p>}
                    {selectedCustomer.phone && <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{selectedCustomer.phone}</p>}
                  </div>
                )}
              </div>

              {/* PRODUCTS section */}
              <div style={{ padding: '1.25rem 1.5rem', background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)', backdropFilter: 'var(--glass-blur-l1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <ShoppingCart size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                    PRODUCTS
                  </span>
                </div>

                {/* Product selector row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.6rem', alignItems: 'end', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.68rem' }}>PRODUCT SKU</label>
                    <select className="form-select" value={currentProductId} onChange={e => setCurrentProductId(e.target.value)}>
                      <option value="">-- Choose Product --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku}) — ₹{p.unit_price} | Stock: {p.current_stock}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.68rem' }}>QTY</label>
                    <input type="number" min="1" className="form-input" value={currentQuantity} onChange={e => setCurrentQuantity(parseInt(e.target.value, 10))} />
                  </div>
                  <button type="button" className="btn btn-secondary" style={{ gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.85rem' }} onClick={handleAddItem}>
                    <Plus size={13} /> Add
                  </button>
                </div>

                {/* Line items ledger */}
                {selectedItems.length > 0 && (
                  <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table className="data-table" style={{ minWidth: '380px' }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>SKU</th>
                          <th style={{ textAlign: 'right' }}>Unit Price</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((item, idx) => {
                          const prod = products.find(p => p.id === item.product_id);
                          const subtotal = (parseFloat(prod?.unit_price || 0) * item.quantity).toFixed(2);
                          return (
                            <tr key={idx}>
                              <td><span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{prod?.name || '—'}</span></td>
                              <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{prod?.sku || '—'}</span></td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>₹{parseFloat(prod?.unit_price || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.quantity}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>₹{subtotal}</td>
                              <td>
                                <button type="button" onClick={() => handleRemoveItem(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', display: 'flex' }}>
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em', border: '1px dashed var(--border-subtle)', borderRadius: '6px' }}>
                    NO ITEMS ADDED YET
                  </div>
                )}
              </div>

              {/* NOTES section */}
              <div style={{ padding: '1.25rem 1.5rem', background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)', backdropFilter: 'var(--glass-blur-l1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                  <FileText size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                    INTERNAL OPERATIONS NOTE <span style={{ color: 'var(--text-muted)' }}>· OPTIONAL</span>
                  </span>
                </div>
                <textarea
                  className="form-textarea"
                  placeholder="Enter remarks regarding logistics or billing..."
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1 }}>
                  Saving as draft does not change inventory.
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                  <FileText size={14} /> Save as Draft
                </button>
              </div>
            </div>

            {/* ── RIGHT COLUMN — Transaction summary ── */}
            <div style={{
              padding: '1.25rem', background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
              backdropFilter: 'var(--glass-blur-l1)', borderRadius: '10px', position: 'sticky', top: '1rem',
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                TRANSACTION SUMMARY
              </p>

              {[
                { label: 'ITEMS', value: `${selectedItems.length}` },
                { label: 'TOTAL QUANTITY', value: `${liveTotalQty} units` },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{r.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{r.value}</span>
                </div>
              ))}

              <div style={{ padding: '0.85rem 0', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>SUBTOTAL</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                  ₹{liveTotalValue.toFixed(2)}
                </span>
              </div>

              <div style={{ padding: '0.65rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>STATUS</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
                  padding: '0.18rem 0.55rem', borderRadius: '4px',
                  background: STATUS_BG['draft'], border: `1px solid ${STATUS_BORDER['draft']}`, color: STATUS_COLOR['draft'],
                }}>
                  DRAFT
                </span>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LEDGER VIEW
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Confirm dialog overlay (from ledger row) */}
      {confirmingChallan && (
        <ConfirmDialog
          challanNumber={confirmingChallan.number}
          onConfirm={() => handleConfirmChallan(confirmingChallan.id, confirmingChallan.number)}
          onCancel={() => setConfirmingChallan(null)}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
            TRANSACTION LEDGER
          </p>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Sales Challans</h2>
        </div>
        {showActions && (
          <button className="btn btn-primary" style={{ gap: '0.4rem' }} onClick={() => setShowAddForm(true)}>
            <Plus size={15} /> Create Challan
          </button>
        )}
      </div>

      {/* Feedback banners */}
      {successFeedback && (
        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--color-success)', fontWeight: 600, fontSize: '0.88rem' }}>
          {successFeedback}
        </div>
      )}
      {errorFeedback && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.85rem 1.25rem', borderRadius: '8px', marginBottom: '1.25rem', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 700 }}>INSUFFICIENT STOCK · </span>{errorFeedback.message}
          {errorFeedback.details && (
            <span style={{ fontFamily: 'var(--font-mono)', display: 'block', fontSize: '0.78rem', marginTop: '0.3rem' }}>
              Requested: {errorFeedback.details.requested} · Available: {errorFeedback.details.available}
            </span>
          )}
        </div>
      )}

      {/* Operational summary strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap',
        background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
        backdropFilter: 'var(--glass-blur-l1)', borderRadius: '8px',
        padding: '0.7rem 1.4rem', marginBottom: '1.25rem',
      }}>
        {[
          { label: 'TOTAL CHALLANS', value: String(challans.length).padStart(2,'0'), color: 'var(--text-primary)' },
          { label: 'DRAFTS',         value: String(draftCount).padStart(2,'0'),      color: 'var(--color-warning)' },
          { label: 'CONFIRMED',      value: String(confirmedCount).padStart(2,'0'),  color: 'var(--color-success)' },
          { label: 'TOTAL VALUE',    value: `₹${totalValue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`, color: 'var(--accent-primary)' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.2rem', color: item.color, lineHeight: 1 }}>
              {item.value}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={15} />
          <input
            type="text"
            className="form-input"
            placeholder="Search challan / customer..."
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
            value={ledgerSearch}
            onChange={e => setLedgerSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {(['all', 'draft', 'confirmed'] as const).map(f => (
            <button key={f} style={fPill(statusFilter === f)} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : f === 'draft' ? 'Draft' : 'Confirmed'}
            </button>
          ))}
        </div>
      </div>

      {/* Challans table */}
      <div className="table-container" style={{ overflowX: 'auto' }}>
        <table className="data-table" style={{ minWidth: '640px' }}>
          <thead>
            <tr>
              <th>Challan Number</th>
              <th>Customer</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total Qty</th>
              <th style={{ textAlign: 'right' }}>Total Value</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredChallans.map(ch => {
              const sk = ch.status.toLowerCase();
              return (
                <tr
                  key={ch.id}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                >
                  {/* Challan number */}
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.88rem', color: 'var(--accent-primary)', letterSpacing: '0.04em' }}>
                      {ch.challan_number}
                    </span>
                  </td>

                  {/* Customer */}
                  <td>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', display: 'block' }}>{ch.customer_name}</span>
                    {ch.customer_business_name && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{ch.customer_business_name}</span>
                    )}
                  </td>

                  {/* Status badge */}
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700,
                      padding: '0.2rem 0.55rem', borderRadius: '4px', letterSpacing: '0.06em',
                      background: STATUS_BG[sk] ?? 'transparent',
                      border: `1px solid ${STATUS_BORDER[sk] ?? 'var(--border-subtle)'}`,
                      color: STATUS_COLOR[sk] ?? 'var(--text-muted)',
                    }}>
                      {ch.status.toUpperCase()}
                    </span>
                  </td>

                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {ch.total_quantity} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>units</span>
                  </td>

                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>
                    ₹{parseFloat(ch.total_amount).toFixed(2)}
                  </td>

                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {ch.created_by}
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem' }}
                        onClick={() => setSelectedChallanId(ch.id)}
                      >
                        Details
                      </button>
                      {ch.status === 'Draft' && showActions && (
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.72rem', padding: '0.28rem 0.65rem', gap: '0.3rem' }}
                          onClick={() => setConfirmingChallan({ id: ch.id, number: ch.challan_number })}
                        >
                          <Check size={12} /> Confirm
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredChallans.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', letterSpacing: '0.08em' }}>
                  NO CHALLANS FOUND
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Challans;
