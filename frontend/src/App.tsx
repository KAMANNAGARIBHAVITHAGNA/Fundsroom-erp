import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import Inventory from './components/Inventory';
import Challans from './components/Challans';
import Intelligence from './components/Intelligence';
import ActivityLog from './components/ActivityLog';
import { CommandPalette } from './components/CommandPalette';
import { WelcomeIntro } from './components/WelcomeIntro';

const PortalViewport: React.FC = () => {
  const { user, currentTab } = useApp();

  if (!user) {
    return <Login />;
  }

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'crm':
        return <CRM />;
      case 'inventory':
        return <Inventory />;
      case 'challans':
        return <Challans />;
      case 'intelligence':
        return <Intelligence />;
      case 'activity':
        return <ActivityLog />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      <CommandPalette />
      <Sidebar />
      <main className="main-viewport">
        {renderActiveView()}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const [showIntro, setShowIntro] = React.useState(() => {
    return !sessionStorage.getItem('intro_seen');
  });

  return (
    <AppProvider>
      {showIntro ? (
        <WelcomeIntro onComplete={() => setShowIntro(false)} />
      ) : (
        <PortalViewport />
      )}
    </AppProvider>
  );
};

export default App;
