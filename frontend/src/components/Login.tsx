import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert } from 'lucide-react';

const Login: React.FC = () => {
  const { login, apiFetch } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {/* 4-pointed sparkle logo */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', position: 'relative' }}>
            {/* Soft radial glow backdrop */}
            <div style={{
              position: 'absolute', inset: '-14px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <svg
              width="58" height="58"
              viewBox="0 0 58 58"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ position: 'relative', filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.6))' }}
            >
              <defs>
                <linearGradient id="star-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              {/*
                4-pointed star using a smooth path:
                Top point → right curve → right point → bottom curve →
                bottom point → left curve → left point → top curve → close
              */}
              <path
                d="
                  M29 3
                  C29 3 32 18 35 22
                  C39 26 55 29 55 29
                  C55 29 39 32 35 36
                  C32 40 29 55 29 55
                  C29 55 26 40 23 36
                  C19 32 3 29 3 29
                  C3 29 19 26 23 22
                  C26 18 29 3 29 3
                  Z
                "
                fill="url(#star-grad)"
              />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>FUNDSROOM</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Operations Intelligence Portal</p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input 
              type="email" 
              className="form-input" 
              placeholder="e.g. admin@fundsroom.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In to Portal'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '0.75rem', textAlign: 'center' }}>Demo Quick Login</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => fillCredentials('admin@fundsroom.com', 'Admin123!')}>ADMIN</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => fillCredentials('sales@fundsroom.com', 'Sales123!')}>SALES</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => fillCredentials('warehouse@fundsroom.com', 'Warehouse123!')}>WAREHOUSE</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem' }} onClick={() => fillCredentials('accounts@fundsroom.com', 'Accounts123!')}>ACCOUNTS</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
