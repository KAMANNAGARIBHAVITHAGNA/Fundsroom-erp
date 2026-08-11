import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search, UserPlus, Phone, Mail, Plus, Calendar, Save, ArrowLeft,
  MapPin, Hash, Briefcase, MessageSquare,
} from 'lucide-react';

// ─── Status colour system ───────────────────────────────────────────────────
const STATUS_CFG: Record<string, { bg: string; border: string; color: string }> = {
  active:   { bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.22)',  color: 'var(--color-success)' },
  lead:     { bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.22)',  color: 'var(--color-warning)' },
  inactive: { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.22)', color: 'var(--text-muted)' },
};

// ─── Initials avatar ────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'rgba(99,102,241,0.55)', 'rgba(16,185,129,0.45)', 'rgba(245,158,11,0.45)',
  'rgba(236,72,153,0.4)',  'rgba(14,165,233,0.45)',
];
const InitialsAvatar: React.FC<{ name: string; size?: number }> = ({ name, size = 38 }) => {
  const words = (name || '?').trim().split(/\s+/);
  const initials = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
  const colorIdx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '8px', flexShrink: 0,
      background: AVATAR_COLORS[colorIdx],
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 700,
      fontSize: size > 50 ? '1.2rem' : '0.8rem', color: '#fff',
      letterSpacing: '0.02em',
    }}>
      {initials}
    </div>
  );
};

// ─── Status badge ────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg = STATUS_CFG[status.toLowerCase()] ?? STATUS_CFG.inactive;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.06em',
      padding: '0.18rem 0.55rem', borderRadius: '4px',
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
    }}>
      {status.toUpperCase()}
    </span>
  );
};

// ─── Form section wrapper ─────────────────────────────────────────────────────
const FormSection: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div style={{
    padding: '1.25rem 1.5rem',
    background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
    backdropFilter: 'var(--glass-blur-l1)', borderRadius: '10px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
      <span style={{ color: 'var(--accent-primary)', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
        {label}
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
      {children}
    </div>
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
const CRM: React.FC = () => {
  const { user, apiFetch, signalDataChange, dataVersion } = useApp();

  // All existing state — preserved exactly
  const [customers, setCustomers]                 = useState<any[]>([]);
  const [search, setSearch]                       = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer]   = useState<any>(null);
  const [showAddForm, setShowAddForm]             = useState(false);

  // Form State
  const [name, setName]                 = useState('');
  const [phone, setPhone]               = useState('');
  const [email, setEmail]               = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber]       = useState('');
  const [customerType, setCustomerType] = useState('Wholesale');
  const [address, setAddress]           = useState('');
  const [status, setStatus]             = useState('Active');
  const [followUpDate, setFollowUpDate] = useState('');

  // Note State
  const [newNoteContent, setNewNoteContent] = useState('');

  // UI-only: client-side status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'lead' | 'inactive'>('all');

  // ── All existing data-loading — preserved exactly ────────────────────
  const loadCustomers = async () => {
    try {
      const data = await apiFetch(`/api/customers?search=${search}`);
      setCustomers(data.customers);
    } catch (error) { console.error(error); }
  };

  const loadCustomerDetail = async (id: string) => {
    try {
      const data = await apiFetch(`/api/customers/${id}`);
      setSelectedCustomer(data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { loadCustomers(); }, [search]);

  // ── Re-fetch when another module signals customers domain changed ──
  useEffect(() => { loadCustomers(); }, [dataVersion.customers]);

  useEffect(() => {
    if (selectedCustomerId) loadCustomerDetail(selectedCustomerId);
    else setSelectedCustomer(null);
  }, [selectedCustomerId]);

  // ── All existing handlers — preserved exactly ────────────────────────
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name, phone, email, business_name: businessName, gst_number: gstNumber,
          customer_type: customerType, address, status, follow_up_date: followUpDate || null,
        }),
      });
      setShowAddForm(false);
      resetForm();
      loadCustomers();
      signalDataChange('customers', 'activity');
    } catch (error: any) { alert(error.message); }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !selectedCustomerId) return;
    try {
      await apiFetch(`/api/customers/${selectedCustomerId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: newNoteContent }),
      });
      setNewNoteContent('');
      loadCustomerDetail(selectedCustomerId);
      signalDataChange('customers', 'activity');
    } catch (error: any) { alert(error.message); }
  };

  const resetForm = () => {
    setName(''); setPhone(''); setEmail(''); setBusinessName(''); setGstNumber('');
    setCustomerType('Wholesale'); setAddress(''); setStatus('Active'); setFollowUpDate('');
  };

  const showActions = ['ADMIN', 'SALES'].includes(user?.role || '');

  // ── Derived summary stats (real data) ────────────────────────────────
  const activeCount   = customers.filter(c => c.status === 'Active').length;
  const leadCount     = customers.filter(c => c.status === 'Lead').length;
  const followUpCount = customers.filter(c => c.follow_up_date).length;

  // ── Client-side filter ────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    if (statusFilter === 'all') return customers;
    return customers.filter(c => c.status.toLowerCase() === statusFilter);
  }, [customers, statusFilter]);

  // ── Filter pill helper ─────────────────────────────────────────────────
  const fPill = (active: boolean) => ({
    padding: '0.22rem 0.75rem', borderRadius: '4px',
    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
    background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
    color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)' as const, fontSize: '0.68rem',
    letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.18s',
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PROFILE VIEW (right-side drawer style over blurred background)
  // ═══════════════════════════════════════════════════════════════════════
  if (selectedCustomer) {
    const cust = selectedCustomer.customer;
    return (
      <div>
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => setSelectedCustomerId(null)}>
          <ArrowLeft size={15} /> Back to CRM
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* LEFT — Customer Identity + Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Identity card */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                <InitialsAvatar name={cust.name} size={52} />
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.2rem', letterSpacing: '-0.01em' }}>{cust.name}</h2>
                  {cust.business_name && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{cust.business_name}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <StatusBadge status={cust.status} />
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.63rem', fontWeight: 600, letterSpacing: '0.06em',
                      padding: '0.18rem 0.55rem', borderRadius: '4px',
                      background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--accent-primary)',
                    }}>{cust.customer_type.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Divider + contact details */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>CONTACT</p>
                {cust.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Phone size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{cust.phone}</span>
                  </div>
                )}
                {cust.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Mail size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{cust.email}</span>
                  </div>
                )}
                {(!cust.phone && !cust.email) && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No contact information available.</p>
                )}
              </div>

              {/* Business details */}
              {(cust.gst_number || cust.address) && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>BUSINESS</p>
                  {cust.gst_number && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Hash size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>GSTIN: {cust.gst_number}</span>
                    </div>
                  )}
                  {cust.address && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                      <MapPin size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{cust.address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Relationship status */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.1rem', marginTop: '1rem' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>RELATIONSHIP</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StatusBadge status={cust.status} />
                  {cust.follow_up_date ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--color-warning)' }}>
                      <Calendar size={12} />
                      Follow-up: {new Date(cust.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No follow-up scheduled</span>
                  )}
                </div>
              </div>

              {/* Transaction signal */}
              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '7px' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--accent-primary)', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>CUSTOMER SIGNAL</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedCustomer.challans.length > 0 ? 'Active Transaction History' : 'No transactions yet'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    {selectedCustomer.challans.length} challan{selectedCustomer.challans.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Timeline + Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Add note form */}
            {showActions && (
              <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
                  <MessageSquare size={14} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                    ADD FOLLOW-UP NOTE
                  </span>
                </div>
                <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <textarea
                    className="form-textarea"
                    placeholder="Enter follow-up update..."
                    rows={3}
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                    required
                    style={{ fontSize: '0.85rem', resize: 'vertical' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 1rem' }}>
                    <Plus size={13} /> Save Note
                  </button>
                </form>
              </div>
            )}

            {/* Activity & notes timeline */}
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem' }}>
                <Calendar size={14} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
                  ACTIVITY &amp; NOTE TIMELINE
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', maxHeight: '400px', overflowY: 'auto', position: 'relative' }}>
                {selectedCustomer.notes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
                    NO NOTES LOGGED YET
                  </div>
                ) : (
                  selectedCustomer.notes.map((note: any, idx: number) => {
                    const ts = new Date(note.created_at);
                    const isLast = idx === selectedCustomer.notes.length - 1;
                    return (
                      <div key={note.id} style={{ display: 'flex', gap: '0.9rem', paddingBottom: isLast ? 0 : '1rem', position: 'relative' }}>
                        {/* Timeline spine */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0, marginTop: '3px', boxShadow: '0 0 6px var(--accent-primary)' }} />
                          {!isLast && <div style={{ width: '1px', flex: 1, background: 'var(--border-subtle)', marginTop: '4px' }} />}
                        </div>
                        {/* Note content */}
                        <div style={{ flex: 1, paddingBottom: isLast ? 0 : '0.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                              FOLLOW-UP NOTE
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              {ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: '0.3rem' }}>
                            "{note.content}"
                          </p>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {note.created_by_name}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADD CUSTOMER FORM
  // ═══════════════════════════════════════════════════════════════════════
  if (showAddForm) {
    return (
      <div>
        <button className="btn btn-secondary" style={{ marginBottom: '1.5rem' }} onClick={() => { setShowAddForm(false); resetForm(); }}>
          <ArrowLeft size={15} /> Back to CRM
        </button>

        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--glass-border-l1)' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
            CRM / RELATIONSHIP INTELLIGENCE
          </p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.2rem', letterSpacing: '-0.02em' }}>
            New Customer
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Create a relationship record</p>
        </div>

        <form onSubmit={handleAddCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '640px' }}>

            <FormSection icon={<UserPlus size={14} />} label="IDENTITY">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Customer Name *</label>
                <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Business Name</label>
                <input type="text" className="form-input" value={businessName} onChange={e => setBusinessName(e.target.value)} />
              </div>
            </FormSection>

            <FormSection icon={<Phone size={14} />} label="CONTACT">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Phone Number</label>
                <input type="text" className="form-input" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Email Address</label>
                <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </FormSection>

            <FormSection icon={<Briefcase size={14} />} label="BUSINESS DETAILS">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>GSTIN (Optional)</label>
                <input type="text" className="form-input" placeholder="e.g. 27AAAAA1111A1Z1" value={gstNumber} onChange={e => setGstNumber(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Customer Type</label>
                <select className="form-select" value={customerType} onChange={e => setCustomerType(e.target.value)}>
                  <option value="Wholesale">Wholesale</option>
                  <option value="Retail">Retail</option>
                  <option value="Distributor">Distributor</option>
                </select>
              </div>
            </FormSection>

            <FormSection icon={<MapPin size={14} />} label="LOCATION & FOLLOW-UP">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Address</label>
                <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Next Follow-up Date</label>
                <input type="date" className="form-input" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} />
              </div>
            </FormSection>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ gap: '0.4rem' }}>
                <Save size={14} /> Create Customer
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CRM DIRECTORY
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--glass-border-l1)' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent-primary)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
            CRM / RELATIONSHIP INTELLIGENCE
          </p>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.2rem' }}>
            Customer CRM Directory
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Manage customer relationships, follow-ups and account activity.
          </p>
        </div>
        {showActions && (
          <button className="btn btn-primary" style={{ gap: '0.4rem', flexShrink: 0 }} onClick={() => setShowAddForm(true)}>
            <UserPlus size={15} /> Add Customer
          </button>
        )}
      </div>

      {/* CRM Summary Strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap',
        background: 'var(--glass-bg-l1)', border: '1px solid var(--glass-border-l1)',
        backdropFilter: 'var(--glass-blur-l1)', borderRadius: '8px',
        padding: '0.7rem 1.4rem', marginBottom: '1.25rem',
      }}>
        {[
          { label: 'TOTAL CUSTOMERS', value: String(customers.length).padStart(2,'0'), color: 'var(--text-primary)' },
          { label: 'ACTIVE',          value: String(activeCount).padStart(2,'0'),       color: 'var(--color-success)' },
          { label: 'LEADS',           value: String(leadCount).padStart(2,'0'),         color: 'var(--color-warning)' },
          { label: 'FOLLOW-UPS',      value: String(followUpCount).padStart(2,'0'),     color: 'var(--accent-secondary)' },
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
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '340px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={15} />
          <input
            type="text"
            className="form-input"
            placeholder="Search customers by name, company or phone..."
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {(['all', 'active', 'lead', 'inactive'] as const).map(f => (
            <button key={f} style={fPill(statusFilter === f)} onClick={() => setStatusFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Directory */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {filteredCustomers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', letterSpacing: '0.08em' }}>
            NO CUSTOMERS FOUND
          </div>
        )}

        {filteredCustomers.map(cust => (
          <div
            key={cust.id}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr auto auto auto auto',
              gap: '1.25rem',
              alignItems: 'center',
              padding: '0.9rem 1.25rem',
              background: 'var(--glass-bg-l1)',
              border: '1px solid var(--glass-border-l1)',
              backdropFilter: 'var(--glass-blur-l1)',
              borderRadius: '10px',
              transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
              cursor: 'default',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = 'translateY(-1px)';
              el.style.background = 'rgba(255,255,255,0.03)';
              el.style.borderColor = 'rgba(99,102,241,0.2)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = '';
              el.style.background = 'var(--glass-bg-l1)';
              el.style.borderColor = 'var(--glass-border-l1)';
            }}
          >
            {/* Avatar */}
            <InitialsAvatar name={cust.name} size={38} />

            {/* Identity */}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cust.name}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cust.business_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </p>
            </div>

            {/* Status + Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
              <StatusBadge status={cust.status} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.06em',
              }}>
                {cust.customer_type.toUpperCase()}
              </span>
            </div>

            {/* Contact */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '100px' }}>
              {cust.phone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Phone size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  {cust.phone}
                </div>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No phone</span>
              )}
              {cust.follow_up_date && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--color-warning)' }}>
                  <Calendar size={10} style={{ flexShrink: 0 }} />
                  {new Date(cust.follow_up_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              )}
            </div>

            {/* GSTIN */}
            <div style={{ minWidth: '90px' }}>
              {cust.gst_number ? (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  {cust.gst_number.slice(0, 15)}
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
              )}
            </div>

            {/* Action */}
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.73rem', padding: '0.3rem 0.7rem', whiteSpace: 'nowrap' }}
              onClick={() => setSelectedCustomerId(cust.id)}
            >
              View Profile
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CRM;
