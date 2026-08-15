import React, { useState } from 'react';
import type { Transaction, Budgets, CurrencyCode, SavingsPot, Account } from '../types';
import {
  formatMoney,
  formatShortDate,
  expenseCategories,
  incomeCategories,
  categoryColors,
  currencyMeta
} from '../utils';
import Charts from './Charts';
import Icon from './Icon';
import SavingsPots from './SavingsPots';

interface DashboardViewProps {
  monthTransactions: Transaction[];
  budgets: Budgets;
  savingsPots: SavingsPot[];
  accounts?: Account[];
  selectedAccount?: string;
  dashboardCurrency: CurrencyCode;
  onBudgetChange: (currency: CurrencyCode, category: string, amount: number) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddSavingsPot: (name: string, targetAmount: number, currency: CurrencyCode) => void;
  onDeleteSavingsPot: (id: string) => void;
  onAdjustSavingsBalance: (id: string, amount: number) => void;
  onAddAccount?: (name: string, type?: Account['type'], currency?: CurrencyCode) => void;
  onDeleteAccount?: (id: string) => void;
  onBulkDeleteTransactions: (ids: string[]) => void;
  onBulkUpdateTransactions: (ids: string[], updates: Partial<Transaction>) => void;
  theme: 'light' | 'dark';
  permissions?: {
    savingsPots: boolean;
    budgets: boolean;
    transactions: boolean;
    multiAccount?: boolean;
  };
  hideTransactionsOnMobile?: boolean;
  showOnlyTransactionsOnMobile?: boolean;
}

const categoryIconMap: Record<string, string> = {
  Rent: 'rent',
  Groceries: 'groceries',
  Dining: 'dining',
  Transport: 'transport',
  Utilities: 'utilities',
  Shopping: 'shopping',
  Entertainment: 'entertainment',
  Health: 'health',
  Travel: 'travel',
  Salary: 'coins',
  Freelance: 'wallet',
  Investments: 'chart',
  Other: 'tag'
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  monthTransactions,
  budgets,
  savingsPots,
  accounts = [],
  selectedAccount = 'all',
  dashboardCurrency,
  onBudgetChange,
  onEditTransaction,
  onDeleteTransaction,
  onAddSavingsPot,
  onDeleteSavingsPot,
  onAdjustSavingsBalance,
  onBulkDeleteTransactions,
  onBulkUpdateTransactions,
  theme,
  permissions,
  hideTransactionsOnMobile,
  showOnlyTransactionsOnMobile
}) => {
  // Local filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'KWD' | 'INR'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');

  // Bulk checking/selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkAccount, setBulkAccount] = useState('');

  // Active transaction set based on topbar Account selector
  const activeTransactions = (selectedAccount && selectedAccount !== 'all')
    ? monthTransactions.filter((t) => t.account === selectedAccount)
    : monthTransactions;

  // Calculate totals stacked by currency
  const calculateTotals = (type?: 'income' | 'expense') => {
    const totals = { KWD: 0, INR: 0 };
    activeTransactions
      .filter((t) => !type || t.type === type)
      .forEach((t) => {
        totals[t.currency] += t.amount;
      });
    return totals;
  };

  const incomeTotals = calculateTotals('income');
  const expenseTotals = calculateTotals('expense');

  const totalSavedKWD = savingsPots.filter((p) => p.currency === 'KWD').reduce((sum, p) => sum + p.currentAmount, 0);
  const totalSavedINR = savingsPots.filter((p) => p.currency === 'INR').reduce((sum, p) => sum + p.currentAmount, 0);

  const balanceTotals = {
    KWD: incomeTotals.KWD - expenseTotals.KWD - totalSavedKWD,
    INR: incomeTotals.INR - expenseTotals.INR - totalSavedINR,
  };

  const getBudgetsSum = () => {
    const totals = { KWD: 0, INR: 0 };
    (['KWD', 'INR'] as CurrencyCode[]).forEach((curr) => {
      totals[curr] = expenseCategories.reduce(
        (sum, cat) => sum + (budgets[curr][cat] || 0),
        0
      );
    });
    return totals;
  };

  const budgetTotals = getBudgetsSum();
  const budgetLeftTotals = {
    KWD: budgetTotals.KWD - expenseTotals.KWD,
    INR: budgetTotals.INR - expenseTotals.INR,
  };

  // Budget left usage meta
  const activeBudget = budgetTotals[dashboardCurrency] || 0;
  const activeExpense = expenseTotals[dashboardCurrency] || 0;
  const budgetUsedPercent = activeBudget > 0 ? Math.round((activeExpense / activeBudget) * 100) : 0;
  const budgetStatusText = activeBudget > 0
    ? `${dashboardCurrency} ${budgetUsedPercent}% used`
    : `${dashboardCurrency} budget not set`;

  // Get active currency spending maps for budget progress bars
  const activeMonthExpenses = activeTransactions.filter(
    (t) => t.type === 'expense' && t.currency === dashboardCurrency
  );
  const spendingMap = new Map<string, number>();
  activeMonthExpenses.forEach((t) => {
    spendingMap.set(t.category, (spendingMap.get(t.category) || 0) + t.amount);
  });

  // Filter and sort transactions
  const filteredTransactions = activeTransactions
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => currencyFilter === 'all' || t.currency === currencyFilter)
    .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
    .filter((t) => accountFilter === 'all' || t.account === accountFilter)
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.merchant.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.account.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        t.currency.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.date === b.date) {
        return b.id.localeCompare(a.id);
      }
      return b.date.localeCompare(a.date);
    });

  const allCategories = [...new Set([...expenseCategories, ...incomeCategories])];

  const handleBudgetInputChange = (cat: string, value: string) => {
    const numVal = Math.max(0, Number(value) || 0);
    onBudgetChange(dashboardCurrency, cat, numVal);
  };

  const expenseEntriesCount = monthTransactions.filter((t) => t.type === 'expense').length;

  // Bulk actions handlers
  const handleToggleSelectAll = () => {
    const shownIds = filteredTransactions.map((t) => t.id);
    const allShownSelected = shownIds.every((id) => selectedIds.includes(id));
    if (allShownSelected) {
      setSelectedIds((prev) => prev.filter((id) => !shownIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...shownIds])]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkReconcile = (status: boolean) => {
    onBulkUpdateTransactions(selectedIds, { reconciled: status });
    setSelectedIds([]);
  };

  const handleBulkCategoryChange = (cat: string) => {
    if (!cat) return;
    onBulkUpdateTransactions(selectedIds, { category: cat });
    setBulkCategory('');
    setSelectedIds([]);
  };

  const handleBulkAccountChange = (acc: string) => {
    if (!acc) return;
    onBulkUpdateTransactions(selectedIds, { account: acc });
    setBulkAccount('');
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    onBulkDeleteTransactions(selectedIds);
    setSelectedIds([]);
  };

  const isAllSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t) => selectedIds.includes(t.id));

  return (
    <section className="main-area" aria-label="Expense dashboard">
      <div className="dashboard-view" id="dashboardView">
        {/* Summary Metric Cards */}
        <div className={`metrics-grid ${showOnlyTransactionsOnMobile ? 'hidden-mobile' : ''}`} aria-label="Monthly summary" style={{ marginBottom: '22px' }}>
          <article className="metric income">
            <div className="metric-top">
              <span className="metric-label">Balance</span>
              <div className="metric-icon">
                <Icon name="wallet" />
              </div>
            </div>
            <div className="metric-value tabular-nums" id="balanceValue">
              {formatMoney(balanceTotals[dashboardCurrency], dashboardCurrency)}
            </div>
            <div className="metric-sub">
              <span>{formatMoney(balanceTotals[dashboardCurrency === 'INR' ? 'KWD' : 'INR'], dashboardCurrency === 'INR' ? 'KWD' : 'INR')}</span>
              <span>• {monthTransactions.length} entries</span>
            </div>
            <svg className="metric-sparkline" viewBox="0 0 100 40">
              <path d="M0,35 Q20,25 40,30 T80,10 T100,5" fill="none" stroke="var(--green)" strokeWidth="2.5" />
            </svg>
          </article>

          <article className="metric">
            <div className="metric-top">
              <span className="metric-label">Total Budget</span>
              <div className="metric-icon">
                <Icon name="pieChart" />
              </div>
            </div>
            <div className="metric-value tabular-nums" id="budgetTotalValue">
              {formatMoney(budgetTotals[dashboardCurrency], dashboardCurrency)}
            </div>
            <div className="metric-sub">
              <span>{formatMoney(budgetTotals[dashboardCurrency === 'INR' ? 'KWD' : 'INR'], dashboardCurrency === 'INR' ? 'KWD' : 'INR')}</span>
              <span>• Allocated limits</span>
            </div>
            <svg className="metric-sparkline" viewBox="0 0 100 40">
              <path d="M0,20 Q30,20 60,20 T100,20" fill="none" stroke="var(--blue)" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          </article>

          <article className="metric expense">
            <div className="metric-top">
              <span className="metric-label">Actual Spent</span>
              <div className="metric-icon">
                <Icon name="arrowUpRight" />
              </div>
            </div>
            <div className="metric-value tabular-nums" id="expenseValue">
              {formatMoney(expenseTotals[dashboardCurrency], dashboardCurrency)}
            </div>
            <div className="metric-sub">
              <span>{formatMoney(expenseTotals[dashboardCurrency === 'INR' ? 'KWD' : 'INR'], dashboardCurrency === 'INR' ? 'KWD' : 'INR')}</span>
              <span>• {expenseEntriesCount} payments</span>
            </div>
            <svg className="metric-sparkline" viewBox="0 0 100 40">
              <path d="M0,35 Q30,30 50,15 T100,5" fill="none" stroke="var(--red)" strokeWidth="2.5" />
            </svg>
          </article>

          <article className="metric warning">
            <div className="metric-top">
              <span className="metric-label">Budget Variance</span>
              <div className="metric-icon">
                <Icon name="scale" />
              </div>
            </div>
            <div className="metric-value tabular-nums" id="budgetLeftValue">
              {formatMoney(budgetLeftTotals[dashboardCurrency], dashboardCurrency)}
            </div>
            <div className="metric-sub">
              <span>{budgetStatusText}</span>
            </div>
            <svg className="metric-sparkline" viewBox="0 0 100 40">
              <path d="M0,10 Q25,25 60,15 T100,30" fill="none" stroke="var(--amber)" strokeWidth="2.5" />
            </svg>
          </article>
        </div>

        {/* Dashboard Main Content Layout */}
        <div className="dashboard-content-layout">
          {/* Main Left Column (Charts + Transactions Register) */}
          <div className="dashboard-main-col">
            <Charts
              transactions={monthTransactions}
              dashboardCurrency={dashboardCurrency}
              theme={theme}
              hideOnMobile={showOnlyTransactionsOnMobile}
            />

            {/* Transactions Register */}
            <section className={`panel register-panel ${hideTransactionsOnMobile ? 'hidden-mobile' : ''}`} aria-label="Transactions">
              <div className="panel-heading register-heading">
                <div>
                  <h2>Transactions</h2>
                </div>
                <div className="register-count" id="registerCount">
                  {`${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'item' : 'items'}`}
                </div>
              </div>

              {/* Filters bar */}
              <div className="filters">
                <label className="search-field" htmlFor="searchInput">
                  <Icon name="search" />
                  <input
                    id="searchInput"
                    type="search"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>

                <label className="select-field" htmlFor="typeFilter">
                  <Icon name="filter" />
                  <select
                    id="typeFilter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                  >
                    <option value="all">All types</option>
                    <option value="expense">Expenses</option>
                    <option value="income">Income</option>
                  </select>
                </label>

                <label className="select-field" htmlFor="currencyFilter">
                  <Icon name="coins" />
                  <select
                    id="currencyFilter"
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value as any)}
                  >
                    <option value="all">All currencies</option>
                    <option value="KWD">KWD</option>
                    <option value="INR">INR</option>
                  </select>
                </label>

                <label className="select-field" htmlFor="categoryFilter">
                  <Icon name="wallet" />
                  <select
                    id="categoryFilter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                <label className="select-field" htmlFor="accountFilter">
                  <Icon name="credit-card" />
                  <select
                    id="accountFilter"
                    value={accountFilter}
                    onChange={(e) => setAccountFilter(e.target.value)}
                  >
                    <option value="all">All accounts</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Batch Action Toolbar */}
              {selectedIds.length > 0 && (
                <div className="bulk-toolbar" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--surface-muted)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>
                    {selectedIds.length} selected
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => handleBulkReconcile(true)}
                      style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                    >
                      <Icon name="check" /> Mark Reconciled
                    </button>
                    <button
                      type="button"
                      className="button button-soft"
                      onClick={() => handleBulkReconcile(false)}
                      style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                    >
                      Un-reconcile
                    </button>
                    <select
                      value={bulkCategory}
                      onChange={(e) => handleBulkCategoryChange(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-glass)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        height: '32px'
                      }}
                    >
                      <option value="">Move Category...</option>
                      {expenseCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      {incomeCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>

                    <select
                      value={bulkAccount}
                      onChange={(e) => handleBulkAccountChange(e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-glass)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: '12px',
                        height: '32px'
                      }}
                    >
                      <option value="">Change Account...</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.name}>{acc.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="button button-soft danger"
                      onClick={handleBulkDelete}
                      style={{ height: '32px', fontSize: '12px', padding: '0 10px' }}
                    >
                      <Icon name="trash" /> Delete Selected
                    </button>
                  </div>
                </div>
              )}

              {/* Transactions Table */}
              {filteredTransactions.length > 0 ? (
                <div className="table-wrapper">
                  <table className="transactions-table">
                    <thead>
                      <tr>
                        {(permissions?.transactions ?? true) && (
                          <th style={{ width: '40px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleToggleSelectAll}
                              aria-label="Select all transactions"
                            />
                          </th>
                        )}
                        <th>Date</th>
                        <th>Payee / Merchant</th>
                        <th>Category</th>
                        <th>Account</th>
                        <th>Amount</th>
                        {(permissions?.transactions ?? true) && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t) => (
                        <tr key={t.id} className={selectedIds.includes(t.id) ? 'selected-row' : ''}>
                          {(permissions?.transactions ?? true) && (
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(t.id)}
                                onChange={() => handleToggleSelectRow(t.id)}
                                aria-label={`Select transaction ${t.merchant}`}
                              />
                            </td>
                          )}
                          <td data-label="Date">{formatShortDate(t.date)}</td>
                          <td data-label="Merchant">
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t.merchant}</div>
                            {t.notes && <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>{t.notes}</div>}
                          </td>
                          <td data-label="Category">
                            <span className={`badge badge-${t.type}`}>
                              <span
                                className="legend-dot"
                                style={{ background: categoryColors[t.category] || categoryColors.Other || '#66727f' }}
                              ></span>
                              <span>{t.category}</span>
                            </span>
                          </td>
                          <td data-label="Account">{t.account || 'KNET / Debit Card'}</td>
                          <td data-label="Amount" className={`amount-cell ${t.type}`}>
                            {`${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount, t.currency)}`}
                          </td>
                          {(permissions?.transactions ?? true) && (
                            <td data-label="Actions" className="action-cell">
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  type="button"
                                  onClick={() => onEditTransaction(t)}
                                  title="Edit transaction"
                                  aria-label="Edit transaction"
                                >
                                  <Icon name="edit" />
                                </button>
                                <button
                                  className="icon-button danger"
                                  type="button"
                                  onClick={() => onDeleteTransaction(t.id)}
                                  title="Delete transaction"
                                  aria-label="Delete transaction"
                                >
                                  <Icon name="trash" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state" id="emptyState">
                  <strong>No transactions yet</strong>
                  <span>Add salary, bills, and payments from the entry panel.</span>
                </div>
              )}
            </section>
          </div>

          {/* Right Sidebar Column (Budgets + Savings Pots) */}
          <div className="dashboard-sidebar-col">
            {/* Budgets Panel */}
            {(permissions?.budgets ?? true) && (
              <section className={`panel budget-panel ${showOnlyTransactionsOnMobile ? 'hidden-mobile' : ''}`} aria-label="Budgets">
                <div className="panel-heading">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="metric-icon" style={{ width: '36px', height: '36px', fontSize: '16px' }}>
                      <Icon name="coins" />
                    </div>
                    <h2 style={{ fontSize: '18px', margin: 0 }}>Budgets</h2>
                  </div>
                  <span className="panel-total" id="budgetCurrencyLabel">{dashboardCurrency} limits</span>
                </div>
                <div id="budgetList" className="budget-list">
                  {expenseCategories.map((cat) => {
                    const spent = spendingMap.get(cat) || 0;
                    const limit = budgets[dashboardCurrency][cat] || 0;
                    const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                    const ratio = limit > 0 ? spent / limit : 0;
                    const iconName = categoryIconMap[cat] || 'tag';

                    let barClass = '';
                    if (ratio >= 1) {
                      barClass = 'over';
                    } else if (ratio >= 0.8) {
                      barClass = 'warning';
                    }

                    return (
                      <div key={cat} className="budget-card-item">
                        <div className="budget-header-row">
                          <div className="budget-cat-info">
                            <div className="budget-cat-icon">
                              <Icon name={iconName} />
                            </div>
                            <div>
                              <div className="budget-cat-name">{cat}</div>
                              <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                                {limit > 0 ? `${formatMoney(spent, dashboardCurrency)} spent` : 'No limit set'}
                              </div>
                            </div>
                          </div>

                          <div className="budget-amounts">
                            <div>{`${formatMoney(spent, dashboardCurrency)} / ${formatMoney(limit, dashboardCurrency)}`}</div>
                            {limit > 0 && (
                              <span className={`variance-pill ${ratio >= 1 ? 'over' : 'left'}`} style={{
                                display: 'inline-block',
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: '12px',
                                marginTop: '2px',
                                background: ratio >= 1 ? 'var(--red-soft)' : 'var(--green-soft)',
                                color: ratio >= 1 ? 'var(--red-text)' : 'var(--green-text)'
                              }}>
                                {ratio >= 1 
                                  ? `${formatMoney(spent - limit, dashboardCurrency)} over`
                                  : `${formatMoney(limit - spent, dashboardCurrency)} left`
                                }
                              </span>
                            )}
                          </div>
                        </div>

                        {limit > 0 && (
                          <div className="budget-progress-track">
                            <div className={`budget-progress-fill ${barClass}`} style={{ width: `${percent}%` }} />
                          </div>
                        )}

                        <div className="budget-limit-control">
                          <span className="budget-limit-label">Limit ({dashboardCurrency})</span>
                          <input
                            className="budget-input-field"
                            type="number"
                            min="0"
                            step={currencyMeta[dashboardCurrency]?.step || '0.01'}
                            value={limit || ''}
                            onChange={(e) => handleBudgetInputChange(cat, e.target.value)}
                            placeholder="0.00"
                            aria-label={`${cat} ${dashboardCurrency} budget`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Savings Pots Panel */}
            {(permissions?.savingsPots ?? true) && (
              <div className={`budget-panel ${showOnlyTransactionsOnMobile ? 'hidden-mobile' : ''}`}>
                <SavingsPots
                  savingsPots={savingsPots}
                  onAddPot={onAddSavingsPot}
                  onDeletePot={onDeleteSavingsPot}
                  onAdjustBalance={onAdjustSavingsBalance}
                  dashboardCurrency={dashboardCurrency}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
export default DashboardView;
