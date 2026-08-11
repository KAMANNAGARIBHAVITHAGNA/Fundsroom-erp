import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, Users, Package, ArrowUpRight, BrainCircuit, Activity, LogOut } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { user, currentTab, setCurrentTab, logout } = useApp();

  if (!user) return null;

  const showCRM = ['ADMIN', 'SALES', 'ACCOUNTS'].includes(user.role);
  const showInventory = ['ADMIN', 'SALES', 'WAREHOUSE'].includes(user.role);
  const showChallans = ['ADMIN', 'SALES', 'ACCOUNTS'].includes(user.role);
  const showIntelligence = ['ADMIN', 'WAREHOUSE'].includes(user.role);

  return (
    <aside className="sidebar">
      <div>
        <div className="brand-section">
          <div className="brand-logo">
            <span>✦</span> FUNDSROOM
          </div>
          <div className="brand-badge">Intel</div>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Command Center</span>
          </button>

          {showCRM && (
            <button 
              className={`nav-link ${currentTab === 'crm' ? 'active' : ''}`}
              onClick={() => setCurrentTab('crm')}
            >
              <Users size={18} />
              <span>CRM / Customers</span>
            </button>
          )}

          {showInventory && (
            <button 
              className={`nav-link ${currentTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setCurrentTab('inventory')}
            >
              <Package size={18} />
              <span>Inventory / Stock</span>
            </button>
          )}

          {showChallans && (
            <button 
              className={`nav-link ${currentTab === 'challans' ? 'active' : ''}`}
              onClick={() => setCurrentTab('challans')}
            >
              <ArrowUpRight size={18} />
              <span>Sales Challans</span>
            </button>
          )}

          {showIntelligence && (
            <button 
              className={`nav-link ${currentTab === 'intelligence' ? 'active' : ''}`}
              onClick={() => setCurrentTab('intelligence')}
            >
              <BrainCircuit size={18} />
              <span>Intelligence</span>
            </button>
          )}

          <button 
            className={`nav-link ${currentTab === 'activity' ? 'active' : ''}`}
            onClick={() => setCurrentTab('activity')}
          >
            <Activity size={18} />
            <span>Activity Timeline</span>
          </button>
        </nav>
      </div>

      <div className="user-profile-section">
        <div className="user-avatar">
          {user.full_name.charAt(0)}
        </div>
        <div className="user-info">
          <span className="user-name">{user.full_name}</span>
          <span className="user-role" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <span>{user.role}</span>
            {user.demo && <span className="status-pill attention" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '4px', lineHeight: 1 }}>DEMO</span>}
          </span>
        </div>
        <button className="logout-btn" onClick={logout} title="Sign Out">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
