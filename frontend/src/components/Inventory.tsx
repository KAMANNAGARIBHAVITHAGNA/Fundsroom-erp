import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Plus, TrendingUp, TrendingDown, ArrowLeftRight, Save, Package, AlertTriangle } from 'lucide-react';

// ─── Inline mini stock bar ──────────────────────────────────────────────────
const StockMiniBar: React.FC<{ current: number; minimum: number; isLow: boolean }> = ({
  current, minimum, isLow,
}) => {
  const max = Math.max(current, minimum) * 1.2 || 1;
  const pct = Math.min(100, (current / max) * 100);
  const color = isLow ? 'var(--color-critical)' : 'var(--color-success)';
  return (
    <div style={{ minWidth: '80px' }}>
      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', position: 'relative', marginTop: '4px' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: '2px', transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)',
          boxShadow: `0 0 4px ${color}66`,
        }} />
      </div>
    </div>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
const Inventory: React.FC = () => {
  const { user, apiFetch, signalDataChange, dataVersion } = useApp();

  // All existing state — preserved exactly
  const [products, setProducts]           = useState<any[]>([]);
  const [movements, setMovements]         = useState<any[]>([]);
  const [search, setSearch]               = useState('');
  const [activeSubTab, setActiveSubTab]   = useState<'products' | 'movements'>('products');
  const [showAddForm, setShowAddForm]     = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);

  // New Product Form State
  const [name, setName]               = useState('');
  const [sku, setSku]                 = useState('');
  const [category, setCategory]       = useState('');
  const [unitPrice, setUnitPrice]     = useState(0);
  const [initialStock, setInitialStock] = useState(0);
  const [minimumStock, setMinimumStock] = useState(10);
  const [location, setLocation]       = useState('');

  // Adjust Stock Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [movementType, setMovementType]             = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity]                     = useState(1);
  const [reason, setReason]                         = useState('');

  // ── UI-only filter state (no API change) ──────────────────────────────
  const [stockFilter, setStockFilter]     = useState<'all' | 'low' | 'stable'>('all');
  const [movDirFilter, setMovDirFilter]   = useState<'all' | 'IN' | 'OUT'>('all');

  // ── All existing data-loading ─────────────────────────────────────────
  const loadInventory = async () => {
    try {
      if (activeSubTab === 'products') {
        const data = await apiFetch(`/api/products?search=${search}`);
        setProducts(data.products);
      } else {
        const data = await apiFetch('/api/inventory/movements');
        setMovements(data.movements);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { loadInventory(); }, [search, activeSubTab]);

  // ── Re-fetch when another module signals inventory changed (e.g. challan confirmation) ──
  useEffect(() => { loadInventory(); }, [dataVersion.inventory]);

  // ── All existing form handlers — preserved exactly ────────────────────
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify({ name, sku, category, unit_price: unitPrice, current_stock: initialStock, minimum_stock: minimumStock, location }),
      });
      setShowAddForm(false);
      resetProductForm();
      loadInventory();
      signalDataChange('inventory', 'activity');
    } catch (error: any) { alert(error.message); }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({ product_id: selectedProductId, movement_type: movementType, quantity, reason }),
      });
      setShowAdjustForm(false);
      resetAdjustForm();
      loadInventory();
      signalDataChange('inventory', 'activity');
    } catch (error: any) { alert(error.message); }
  };

  const resetProductForm = () => { setName(''); setSku(''); setCategory(''); setUnitPrice(0); setInitialStock(0); setMinimumStock(10); setLocation(''); };
  const resetAdjustForm  = () => { setSelectedProductId(''); setMovementType('IN'); setQuantity(1); setReason(''); };

  const showActions = ['ADMIN', 'WAREHOUSE'].includes(user?.role || '');

  // ── Derived snapshot stats (real data) ───────────────────────────────
  const lowStockCount  = products.filter(p => p.current_stock < p.minimum_stock).length;
  const totalUnits     = products.reduce((a, p) => a + (p.current_stock || 0), 0);
  const movCountToday  = movements.filter(m => {
    const d = new Date(m.created_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  }).length;

  const movIn  = movements.filter(m => m.movement_type === 'IN').length;
  const movOut = movements.filter(m => m.movement_type === 'OUT').length;

  // ── Client-side filters (no extra API call) ───────────────────────────
  const filteredProducts = useMemo(() => {
    if (stockFilter === 'low')    return products.filter(p => p.current_stock < p.minimum_stock);
    if (stockFilter === 'stable') return products.filter(p => p.current_stock >= p.minimum_stock);
    return products;
  }, [products, stockFilter]);

  const filteredMovements = useMemo(() => {
    if (movDirFilter === 'IN')  return movements.filter(m => m.movement_type === 'IN');
    if (movDirFilter === 'OUT') return movements.filter(m => m.movement_type === 'OUT');
    return movements;
  }, [movements, movDirFilter]);

  // ── Filter pill button style helper ──────────────────────────────────
  const filterPill = (active: boolean) => ({
    padding: '0.2rem 0.7rem',
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

  // ── Row highlight for low-stock rows ─────────────────────────────────
  const lowRowStyle = {
    background: 'rgba(236,72,153,0.04)',
    borderLeft: '2px solid rgba(236,72,153,0.3)',
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Tab bar + action buttons ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeSubTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('products')}
            style={{ fontSize: '0.88rem', padding: '0.45rem 1rem' }}
          >Products Ledger</button>
          <button
            className={`btn ${activeSubTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('movements')}
            style={{ fontSize: '0.88rem', padding: '0.45rem 1rem' }}
          >Movement History</button>
        </div>

        {showActions && activeSubTab === 'products' && !showAddForm && !showAdjustForm && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowAdjustForm(true)}>
              <ArrowLeftRight size={15} /> Adjust Stock
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
              <Plus size={15} /> Add Product
            </button>
          </div>
        )}
      </div>

      {/* ── Add / Adjust forms — preserved exactly ───────────────────── */}
      {showAddForm ? (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add New Product SKU</h3>
          <form onSubmit={handleAddProduct}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">SKU / Code</label>
                <input type="text" className="form-input" placeholder="e.g. IB-X100" value={sku} onChange={e => setSku(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-input" value={category} onChange={e => setCategory(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Price (₹)</label>
                <input type="number" step="0.01" className="form-input" value={unitPrice} onChange={e => setUnitPrice(parseFloat(e.target.value))} required />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Initial Stock Level</label>
                <input type="number" className="form-input" value={initialStock} onChange={e => setInitialStock(parseInt(e.target.value, 10))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Min Alert Stock Threshold</label>
                <input type="number" className="form-input" value={minimumStock} onChange={e => setMinimumStock(parseInt(e.target.value, 10))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Warehouse/Shelf Location</label>
              <input type="text" className="form-input" placeholder="e.g. Shelf A3" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Save size={15} /> Save Product</button>
            </div>
          </form>
        </div>

      ) : showAdjustForm ? (
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Record Manual Inventory Adjustment</h3>
          <form onSubmit={handleAdjustStock}>
            <div className="form-group">
              <label className="form-label">Select Product</label>
              <select className="form-select" value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} required>
                <option value="">-- Choose Product SKU --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) - Current Stock: {p.current_stock}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Adjustment Type</label>
                <select className="form-select" value={movementType} onChange={e => setMovementType(e.target.value as 'IN' | 'OUT')}>
                  <option value="IN">IN (Stock Addition)</option>
                  <option value="OUT">OUT (Stock Deduction)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input type="number" min="1" className="form-input" value={quantity} onChange={e => setQuantity(parseInt(e.target.value, 10))} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Reason / Reference</label>
              <input type="text" className="form-input" placeholder="e.g. Inward Restock, Damaged Goods" value={reason} onChange={e => setReason(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary"><Save size={15} /> Apply Adjustment</button>
            </div>
          </form>
        </div>

      ) : (
        <div>

          {/* ═══════════════ PRODUCTS LEDGER ═════════════════════════ */}
          {activeSubTab === 'products' ? (
            <div>

              {/* Inventory Snapshot Strip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap',
                background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
                backdropFilter: 'var(--glass-blur-l1)', borderRadius: '8px',
                padding: '0.7rem 1.4rem', marginBottom: '1.25rem',
              }}>
                {[
                  { label: 'SKUs', value: String(products.length).padStart(2,'0'), color: 'var(--text-primary)', icon: <Package size={12} /> },
                  { label: 'LOW STOCK', value: String(lowStockCount).padStart(2,'0'), color: lowStockCount > 0 ? 'var(--color-critical)' : 'var(--text-muted)', icon: <AlertTriangle size={12} /> },
                  { label: 'TOTAL UNITS', value: totalUnits.toLocaleString(), color: 'var(--accent-secondary)', icon: null },
                  { label: 'MOVEMENTS TODAY', value: String(movCountToday).padStart(2,'0'), color: 'var(--text-muted)', icon: null },
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

              {/* Search + Filter toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '340px' }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={15} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search products by name or SKU..."
                    style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {(['all', 'low', 'stable'] as const).map(f => (
                    <button key={f} style={filterPill(stockFilter === f)} onClick={() => setStockFilter(f)}>
                      {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Stable'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Products table */}
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '680px' }}>
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>SKU Code</th>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>Price</th>
                      <th>Stock Level</th>
                      <th>Min Safety</th>
                      <th>Location</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map(prod => {
                      const isLow = prod.current_stock < prod.minimum_stock;
                      return (
                        <tr
                          key={prod.id}
                          style={isLow ? lowRowStyle : undefined}
                          onMouseEnter={e => { if (!isLow) (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.025)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isLow ? 'rgba(236,72,153,0.04)' : ''; }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isLow && <AlertTriangle size={12} style={{ color: 'var(--color-critical)', flexShrink: 0 }} />}
                              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{prod.name}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                              {prod.sku}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{prod.category || '—'}</td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                            ₹{parseFloat(prod.unit_price).toFixed(2)}
                          </td>
                          <td>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isLow ? 'var(--color-critical)' : 'var(--text-primary)' }}>
                                {prod.current_stock}
                              </span>
                              <StockMiniBar current={prod.current_stock} minimum={prod.minimum_stock} isLow={isLow} />
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {prod.minimum_stock}
                          </td>
                          <td>
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem',
                              borderRadius: '3px', border: '1px solid var(--border-subtle)',
                            }}>
                              {prod.location || '—'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${isLow ? 'critical' : 'stable'}`} style={{ fontSize: '0.65rem' }}>
                              {isLow ? 'LOW STOCK' : 'STABLE'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          NO PRODUCTS FOUND MATCHING CRITERIA
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          ) : (
            /* ═══════════════ MOVEMENT HISTORY ══════════════════════ */
            <div>

              {/* Movement Overview Strip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap',
                background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
                backdropFilter: 'var(--glass-blur-l1)', borderRadius: '8px',
                padding: '0.7rem 1.4rem', marginBottom: '1.25rem',
              }}>
                {[
                  { label: 'TOTAL MOVEMENTS', value: String(movements.length).padStart(2,'0'), color: 'var(--text-primary)' },
                  { label: 'STOCK IN',         value: String(movIn).padStart(2,'0'),           color: 'var(--color-success)' },
                  { label: 'STOCK OUT',        value: String(movOut).padStart(2,'0'),          color: 'var(--color-critical)' },
                  { label: 'TODAY',            value: String(movCountToday).padStart(2,'0'),   color: 'var(--accent-secondary)' },
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

              {/* Movement direction filter */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1.25rem' }}>
                {(['all', 'IN', 'OUT'] as const).map(f => (
                  <button key={f} style={filterPill(movDirFilter === f)} onClick={() => setMovDirFilter(f)}>
                    {f === 'all' ? 'All Movements' : f === 'IN' ? '↗ IN' : '↘ OUT'}
                  </button>
                ))}
              </div>

              {/* Movements table */}
              <div className="table-container" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '760px' }}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Direction</th>
                      <th>Qty</th>
                      <th>Reason</th>
                      <th>Reference</th>
                      <th>Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovements.map(mov => {
                      const isOut = mov.movement_type === 'OUT';
                      const dirColor = isOut ? 'var(--color-critical)' : 'var(--color-success)';
                      const ts = new Date(mov.created_at);
                      return (
                        <tr
                          key={mov.id}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                        >
                          {/* Timestamp with subtle timeline dot */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{
                                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                background: dirColor, boxShadow: `0 0 4px ${dirColor}88`,
                              }} />
                              <div>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>
                                  {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{mov.product_name}</span>
                          </td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                              {mov.product_sku}
                            </span>
                          </td>

                          {/* Direction badge */}
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700,
                              color: dirColor,
                              background: isOut ? 'rgba(236,72,153,0.08)' : 'rgba(16,185,129,0.08)',
                              border: `1px solid ${isOut ? 'rgba(236,72,153,0.2)' : 'rgba(16,185,129,0.2)'}`,
                              padding: '0.15rem 0.45rem', borderRadius: '4px',
                            }}>
                              {isOut ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                              {mov.movement_type}
                            </span>
                          </td>

                          {/* Qty with +/- colour */}
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem', color: dirColor }}>
                              {isOut ? '-' : '+'}{mov.quantity}
                            </span>
                          </td>

                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mov.reason}</td>

                          {/* Reference — looks interactive if present */}
                          <td>
                            {mov.reference ? (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                                color: 'var(--accent-primary)',
                                background: 'rgba(99,102,241,0.08)',
                                border: '1px solid rgba(99,102,241,0.18)',
                                padding: '0.1rem 0.4rem', borderRadius: '3px',
                                cursor: 'default', letterSpacing: '0.04em',
                              }}>
                                {mov.reference}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>

                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {mov.created_by}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMovements.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          NO STOCK MOVEMENTS RECORDED IN THE LEDGER
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Inventory;
