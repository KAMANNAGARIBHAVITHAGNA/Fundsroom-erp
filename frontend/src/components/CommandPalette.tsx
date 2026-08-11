import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Search, LayoutDashboard, Users, Package, ArrowUpRight, BrainCircuit, Activity, LogOut, Terminal } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const { setCurrentTab, user, logout } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const items = [
    { label: 'Go to Command Center', tab: 'dashboard', icon: <LayoutDashboard size={16} /> },
    { label: 'Go to CRM / Customers', tab: 'crm', icon: <Users size={16} />, role: ['ADMIN', 'SALES', 'ACCOUNTS'] },
    { label: 'Go to Inventory / Stock', tab: 'inventory', icon: <Package size={16} />, role: ['ADMIN', 'SALES', 'WAREHOUSE'] },
    { label: 'Go to Sales Challans', tab: 'challans', icon: <ArrowUpRight size={16} />, role: ['ADMIN', 'SALES', 'ACCOUNTS'] },
    { label: 'Go to Intelligence Module', tab: 'intelligence', icon: <BrainCircuit size={16} />, role: ['ADMIN', 'WAREHOUSE'] },
    { label: 'Go to Activity Timeline', tab: 'activity', icon: <Activity size={16} /> },
    { label: 'Sign Out / Logout', action: logout, icon: <LogOut size={16} />, style: { color: 'var(--color-danger)' } },
  ].filter(item => !item.role || (user && item.role.includes(user.role)));

  const filteredItems = items.filter(item => 
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: typeof items[0]) => {
    if (item.tab) {
      setCurrentTab(item.tab);
    } else if (item.action) {
      item.action();
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 9999
      }}
      onClick={() => setIsOpen(false)}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '540px',
          background: '#0e0e12',
          border: '1px solid var(--border-focus)',
          borderRadius: '12px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.1)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <Search size={18} style={{ color: 'var(--text-muted)', marginRight: '0.75rem' }} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Type a command or search modules..." 
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              outline: 'none',
              width: '100%',
              fontFamily: 'var(--font-sans)'
            }}
          />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>ESC</span>
        </div>

        <div ref={listRef} style={{ padding: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
          {filteredItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div 
                key={idx}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: isSelected ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  transition: 'var(--transition-smooth)',
                  ...item.style
                }}
              >
                {item.icon}
                <span style={{ flexGrow: 1, fontSize: '0.95rem', fontWeight: 500 }}>{item.label}</span>
                {isSelected && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <Terminal size={12} /> Run
                  </span>
                )}
              </div>
            );
          })}
          {filteredItems.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No commands found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
