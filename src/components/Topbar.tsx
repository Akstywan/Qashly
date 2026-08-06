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
  onClear: () => void;
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
  onClear,
  accounts = [],
  selectedAccount = 'all',
  onAccountChange,
  onOpenManageAccounts,
  onOpenUserPreferences,
  onOpenTransferModal,
  onOpenMonthRolloverModal,
}) => {
  const userDisplayName = activeUser ? activeUser.name : currentUser.name;
  const isViewingOtherUser = currentUser.role === 'admin' && activeUser?.id !== currentUser.id;
  const prefix = isViewingOtherUser ? 'Viewing ' : '';

  return (
    <>
      <header className="topbar">
      <div className="brand">
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
            <button
              type="button"
              className="button button-soft"
              onClick={onOpenManageAccounts}
              title="Manage Accounts"
              style={{ padding: '6px 10px', height: '38px', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="accounts" />
              <span>Accounts</span>
            </button>
            <button
              type="button"
              className="button button-soft"
              onClick={onOpenTransferModal}
              title="Transfer Money Between Accounts"
              style={{ padding: '6px 10px', height: '38px', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="transfer" />
              <span>Transfer</span>
            </button>
            <button
              type="button"
              className="button button-soft"
              onClick={onOpenMonthRolloverModal}
              title="Rollover Month Balance to Next Month"
              style={{ padding: '6px 10px', height: '38px', fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="arrowRightLeft" />
              <span>Rollover</span>
            </button>
          </div>
        )}

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

        <button
          className={`button button-soft nav-btn-desktop ${currentView === 'dashboard' ? 'active' : ''}`}
          id="dashboardBtn"
          type="button"
          onClick={() => onViewChange('dashboard')}
        >
          <Icon name="chart" />
          <span>Dashboard</span>
        </button>

        <button
          className={`button button-soft nav-btn-desktop ${currentView === 'report' ? 'active' : ''}`}
          id="reportBtn"
          type="button"
          onClick={() => onViewChange('report')}
        >
          <Icon name="file-text" />
          <span>Report</span>
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

        {(currentView === 'dashboard' || currentView === 'report') && (
          <>
            <button
              className="button button-soft"
              id="exportBtn"
              type="button"
              onClick={onExport}
              title="Export to Excel Spreadsheet"
            >
              <Icon name="download" />
              <span>Export Excel</span>
            </button>

            <button
              className="icon-button danger"
              id="clearBtn"
              type="button"
              onClick={onClear}
              aria-label="Reset data"
              title="Reset data"
            >
              <Icon name="trash" />
            </button>
          </>
        )}

        <button
          className="button button-soft nav-btn-desktop"
          id="userPreferencesBtn"
          type="button"
          onClick={onOpenUserPreferences}
          title="User Preferences (Default Category & Payment Mode)"
        >
          <Icon name="settings" />
          <span>Preferences</span>
        </button>

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
