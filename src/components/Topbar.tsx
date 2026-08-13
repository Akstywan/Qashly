import React from 'react';
import type { User, CurrencyCode, Account } from '../types';
import { formatMonthLabel, firstName } from '../utils';
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
}) => {
  const [showActionsMenu, setShowActionsMenu] = React.useState(false);
  const userDisplayName = activeUser ? activeUser.name : currentUser.name;
  const isViewingOtherUser = currentUser.role === 'admin' && activeUser?.id !== currentUser.id;
  const prefix = isViewingOtherUser ? 'Viewing ' : '';

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
          <p id="monthTitle">{`${formatMonthLabel(month)} - ${userDisplayName}`}</p>
        </div>
      </div>

      <div className="topbar-actions">
        <label className="month-control" htmlFor="monthPicker">
          <span>Month</span>
          <input
            id="monthPicker"
            type="month"
            value={month}
            onChange={(e) => e.target.value && onMonthChange(e.target.value)}
          />
        </label>

        {(currentUser?.permissions?.multiAccount ?? true) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label className="month-control compact-control" htmlFor="accountSelector" style={{ minWidth: '130px' }}>
              <span>Account</span>
              <select
                id="accountSelector"
                value={selectedAccount}
                onChange={(e) => {
                  if (onAccountChange) {
                    onAccountChange(e.target.value);
                  }
                }}
                style={{ fontWeight: 600 }}
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', height: '38px' }}
          >
            <Icon name="plus" />
            <span>Actions</span>
            <Icon name="chevron-down" style={{ fontSize: '10px', opacity: 0.7 }} />
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
                  left: 0,
                  marginTop: '6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: '14px',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
                  minWidth: '170px',
                  padding: '6px',
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  animation: 'fade-in 0.15s ease'
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
                      padding: '9px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
                    padding: '9px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Icon name="download" />
                  <span>Export Excel</span>
                </button>
              </div>
            </>
          )}
        </div>

        <label className="month-control compact-control" htmlFor="dashboardCurrency">
          <span>Currency</span>
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
          className="button button-soft"
          id="themeToggle"
          type="button"
          onClick={onThemeToggle}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          <span id="themeLabel">{theme === 'dark' ? 'Light' : 'Dark'}</span>
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
          title={`Sign out ${currentUser.name}`}
        >
          <Icon name="logout" />
          <span id="currentUserLabel">{`${prefix}${firstName(userDisplayName)}`}</span>
        </button>
      </div>
    </header>

    <nav className="mobile-bottom-nav">
      <button
        className={`mobile-tab-item ${currentView === 'dashboard' ? 'active' : ''}`}
        type="button"
        onClick={() => onViewChange('dashboard')}
      >
        <Icon name="chart" />
        <span>Dashboard</span>
      </button>

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
        onClick={() => onViewChange(currentView === 'profile' ? 'dashboard' : 'profile')}
      >
        <Icon name="user" />
        <span>Profile</span>
      </button>
    </nav>
  </>
  );
};
export default Topbar;
