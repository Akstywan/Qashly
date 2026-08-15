import React from 'react';
import type { User, CurrencyCode, Account } from '../types';
import { formatMonthLabel } from '../utils';
import Icon from './Icon';

interface TopbarProps {
  currentUser: User;
  activeUser: User;
  month: string;
  dashboardCurrency: CurrencyCode;
  theme: 'light' | 'dark';
  currentView: 'dashboard' | 'admin' | 'report' | 'profile' | 'transactions';
  onMonthChange: (month: string) => void;
  onDashboardCurrencyChange: (currency: CurrencyCode) => void;
  onThemeToggle: () => void;
  onViewChange: (view: 'dashboard' | 'admin' | 'report' | 'profile' | 'transactions') => void;
  onSignOut: () => void;
  onExport: () => void;
  onClear?: () => void;
  accounts?: Account[];
  selectedAccount?: string;
  onAccountChange?: (account: string) => void;
  onOpenManageAccounts?: () => void;
  onOpenUserPreferences?: () => void;
  onOpenTransferModal?: () => void;
  onOpenMonthRolloverModal?: () => void;
  onOpenAddTransaction?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  currentUser,
  activeUser,
  month,
  dashboardCurrency,
  theme,
  currentView,
  onMonthChange,
  onDashboardCurrencyChange,
  onThemeToggle,
  onViewChange,
  onSignOut,
  onExport,
  accounts = [],
  selectedAccount = 'all',
  onAccountChange,
  onOpenManageAccounts,
  onOpenUserPreferences,
  onOpenTransferModal,
  onOpenMonthRolloverModal,
  onOpenAddTransaction,
}) => {
  const [showActionsMenu, setShowActionsMenu] = React.useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = React.useState(false);
  const userDisplayName = activeUser ? activeUser.name : currentUser.name;
  const isViewingOtherUser = currentUser.role === 'admin' && activeUser?.id !== currentUser.id;

  return (
    <>
      <header className="topbar">
        <div 
          className="brand"
          onClick={() => onViewChange('dashboard')}
          style={{ cursor: 'pointer' }}
          title="Go to Dashboard"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onViewChange('dashboard');
            }
          }}
        >
          <div className="brand-mark" aria-hidden="true" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>Q</span>
          </div>
          <div>
            <h1>Qashly</h1>
            <p id="monthTitle">{`${formatMonthLabel(month)} • ${isViewingOtherUser ? 'Viewing ' : ''}${userDisplayName}`}</p>
          </div>
        </div>

        {/* Desktop Actions Bar */}
        <div className="topbar-actions desktop-actions">
          <label className="month-control" htmlFor="monthPicker">
            <Icon name="calendar" />
            <input
              id="monthPicker"
              type="month"
              value={month}
              onChange={(e) => e.target.value && onMonthChange(e.target.value)}
            />
          </label>

          {(currentUser?.permissions?.multiAccount ?? true) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label className="month-control compact-control" htmlFor="accountSelector">
                <Icon name="accounts" />
                <select
                  id="accountSelector"
                  value={selectedAccount}
                  onChange={(e) => {
                    if (onAccountChange) {
                      onAccountChange(e.target.value);
                    }
                  }}
                >
                  <option value="all">All Accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Actions Dropdown Menu */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="button button-soft"
              id="actionsMenuBtn"
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              title="Account & Transaction Actions"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '40px' }}
            >
              <Icon name="plus" />
              <span>Actions</span>
              <Icon name="chevron-down" style={{ opacity: 0.7 }} />
            </button>

            {showActionsMenu && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
                  onClick={() => setShowActionsMenu(false)} 
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '180px',
                    padding: '6px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    animation: 'fadeIn 0.18s ease-out'
                  }}
                >
                  {(currentUser?.permissions?.multiAccount ?? true) && (
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setShowActionsMenu(false);
                        onOpenManageAccounts?.();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text)',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <Icon name="accounts" />
                      <span>Create Account</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      onOpenMonthRolloverModal?.();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icon name="arrowRightLeft" />
                    <span>Rollover</span>
                  </button>

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      onOpenTransferModal?.();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icon name="transfer" />
                    <span>Transfer</span>
                  </button>

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      onViewChange('report');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icon name="file-text" />
                    <span>Report</span>
                  </button>

                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      setShowActionsMenu(false);
                      onExport?.();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icon name="download" />
                    <span>Export Excel</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <label className="month-control compact-control" htmlFor="dashboardCurrency">
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Currency</span>
            <select
              id="dashboardCurrency"
              value={dashboardCurrency}
              onChange={(e) => onDashboardCurrencyChange(e.target.value as CurrencyCode)}
            >
              <option value="KWD">KWD</option>
              <option value="INR">INR</option>
            </select>
          </label>

          <button
            className="icon-button"
            id="themeToggle"
            type="button"
            onClick={onThemeToggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>

          {currentUser.role === 'admin' && (
            <button
              className={`button button-soft nav-btn-desktop ${currentView === 'admin' ? 'active' : ''}`}
              id="adminBtn"
              type="button"
              onClick={() => onViewChange('admin')}
            >
              <Icon name="shield" />
              <span>Admin</span>
            </button>
          )}

          <button
            className={`button button-soft nav-btn-desktop ${currentView === 'profile' ? 'active' : ''}`}
            id="profileBtn"
            type="button"
            onClick={() => onViewChange(currentView === 'profile' ? 'dashboard' : 'profile')}
            title="Account Profile Settings"
          >
            <Icon name="user" />
            <span>Profile</span>
          </button>

          <button
            className="button button-soft"
            id="signOutBtn"
            type="button"
            onClick={onSignOut}
            title={`Sign out (${userDisplayName})`}
          >
            <Icon name="logout" />
            <span id="currentUserLabel">Sign out</span>
          </button>
        </div>

        {/* Mobile Compact Actions Header Trigger */}
        <div className="topbar-actions mobile-header-controls">
          <label className="month-control compact-control" htmlFor="mobileMonthPicker" style={{ height: '36px', padding: '0 8px' }}>
            <Icon name="calendar" />
            <input
              id="mobileMonthPicker"
              type="month"
              value={month}
              onChange={(e) => e.target.value && onMonthChange(e.target.value)}
              style={{ width: '100px', fontSize: '12px' }}
            />
          </label>

          {(currentUser?.permissions?.transactions ?? true) && (
            <button
              type="button"
              className="button button-primary"
              onClick={onOpenAddTransaction}
              style={{ height: '36px', padding: '0 10px', fontSize: '12px', gap: '4px' }}
            >
              <Icon name="plus" />
              <span>Add</span>
            </button>
          )}

          <button
            type="button"
            className="icon-button"
            onClick={() => setShowMobileDrawer(true)}
            aria-label="Open navigation menu"
            style={{ width: '36px', height: '36px' }}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Modal Sheet */}
      {showMobileDrawer && (
        <div className="modal-overlay" onClick={() => setShowMobileDrawer(false)}>
          <div className="modal-content animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ width: 'min(400px, 94vw)', padding: '24px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="brand-mark" style={{ width: '36px', height: '36px', fontSize: '18px' }}>Q</div>
                <div>
                  <h3 style={{ fontSize: '17px', margin: 0 }}>Qashly Menu</h3>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{userDisplayName}</span>
                </div>
              </div>
              <button type="button" className="icon-button" onClick={() => setShowMobileDrawer(false)}>
                <Icon name="x" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {(currentUser?.permissions?.multiAccount ?? true) && (
                <div className="form-group">
                  <label htmlFor="drawerAccountSelector">Selected Account</label>
                  <select
                    id="drawerAccountSelector"
                    value={selectedAccount}
                    onChange={(e) => {
                      onAccountChange?.(e.target.value);
                      setShowMobileDrawer(false);
                    }}
                  >
                    <option value="all">All Accounts</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="drawerCurrencySelector">Display Currency</label>
                <select
                  id="drawerCurrencySelector"
                  value={dashboardCurrency}
                  onChange={(e) => {
                    onDashboardCurrencyChange(e.target.value as CurrencyCode);
                    setShowMobileDrawer(false);
                  }}
                >
                  <option value="KWD">KWD (Kuwaiti Dinar)</option>
                  <option value="INR">INR (Indian Rupee)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => {
                    setShowMobileDrawer(false);
                    onOpenManageAccounts?.();
                  }}
                >
                  <Icon name="accounts" />
                  <span>Create Account</span>
                </button>

                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => {
                    setShowMobileDrawer(false);
                    onOpenTransferModal?.();
                  }}
                >
                  <Icon name="transfer" />
                  <span>Transfer</span>
                </button>

                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => {
                    setShowMobileDrawer(false);
                    onOpenMonthRolloverModal?.();
                  }}
                >
                  <Icon name="arrowRightLeft" />
                  <span>Rollover</span>
                </button>

                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => {
                    setShowMobileDrawer(false);
                    onExport?.();
                  }}
                >
                  <Icon name="download" />
                  <span>Export</span>
                </button>
              </div>

              <hr style={{ border: 0, borderTop: '1px solid var(--border-glass)', margin: '12px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-soft"
                  onClick={onThemeToggle}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                  <span>Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode</span>
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    className="button button-soft"
                    onClick={() => {
                      onViewChange('admin');
                      setShowMobileDrawer(false);
                    }}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    <Icon name="shield" />
                    <span>Admin Control Center</span>
                  </button>
                )}

                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => {
                    onViewChange('profile');
                    setShowMobileDrawer(false);
                  }}
                  style={{ justifyContent: 'flex-start' }}
                >
                  <Icon name="user" />
                  <span>Profile Settings</span>
                </button>

                <button
                  type="button"
                  className="button button-soft danger"
                  onClick={() => {
                    setShowMobileDrawer(false);
                    onSignOut();
                  }}
                  style={{ justifyContent: 'flex-start', marginTop: '4px' }}
                >
                  <Icon name="logout" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    <nav className="mobile-bottom-nav">
      {(currentUser?.permissions?.transactions ?? true) && (
        <button
          className={`mobile-tab-item ${currentView === 'transactions' ? 'active' : ''}`}
          type="button"
          onClick={() => onViewChange('transactions')}
        >
          <Icon name="wallet" />
          <span>Transactions</span>
        </button>
      )}

      <button
        className={`mobile-tab-item ${currentView === 'dashboard' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange('dashboard')}
      >
        <Icon name="chart" />
        <span>Spending</span>
      </button>

      <button
        className={`mobile-tab-item ${currentView === 'report' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange('report')}
      >
        <Icon name="file-text" />
        <span>Report</span>
      </button>

      <button
        className="mobile-tab-item"
        type="button"
        onClick={onOpenUserPreferences}
      >
        <Icon name="settings" />
        <span>Prefs</span>
      </button>

      {currentUser.role === 'admin' && (
        <button
          className={`mobile-tab-item ${currentView === 'admin' ? 'active' : ''}`}
          type="button"
          onClick={() => onViewChange('admin')}
        >
          <Icon name="shield" />
          <span>Admin</span>
        </button>
      )}

      <button
        className={`mobile-tab-item ${currentView === 'profile' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange(currentView === 'profile' ? 'transactions' : 'profile')}
      >
        <Icon name="user" />
        <span>Profile</span>
      </button>
    </nav>
  </>
  );
};
export default Topbar;
