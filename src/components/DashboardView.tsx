import React, { useState } from 'react';
import type { Transaction, Budgets, CurrencyCode, SavingsPot } from '../types';
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
  dashboardCurrency: CurrencyCode;
  onBudgetChange: (currency: CurrencyCode, category: string, amount: number) => void;
  onEditTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddSavingsPot: (name: string, targetAmount: number, currency: CurrencyCode) => void;
  onDeleteSavingsPot: (id: string) => void;
  onAdjustSavingsBalance: (id: string, amount: number) => void;
  onBulkDeleteTransactions: (ids: string[]) => void;
  onBulkUpdateTransactions: (ids: string[], updates: Partial<Transaction>) => void;
  theme: 'light' | 'dark';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  monthTransactions,
  budgets,
  savingsPots,
  dashboardCurrency,
  onBudgetChange,
  onEditTransaction,
  onDeleteTransaction,
  onAddSavingsPot,
  onDeleteSavingsPot,
  onAdjustSavingsBalance,
  onBulkDeleteTransactions,
  onBulkUpdateTransactions,
  theme
}) => {
  // Local filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [currencyFilter, setCurrencyFilter] = useState<'all' | 'KWD' | 'INR'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Bulk checking/selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkAccount, setBulkAccount] = useState('');

  // Calculate totals stacked by currency
  const calculateTotals = (type?: 'income' | 'expense') => {
    const totals = { KWD: 0, INR: 0 };
    monthTransactions
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
  const activeMonthExpenses = monthTransactions.filter(
    (t) => t.type === 'expense' && t.currency === dashboardCurrency
  );
  const spendingMap = new Map<string, number>();
  activeMonthExpenses.forEach((t) => {
    spendingMap.set(t.category, (spendingMap.get(t.category) || 0) + t.amount);
  });

  // Filter and sort transactions
  const filteredTransactions = monthTransactions
    .filter((t) => typeFilter === 'all' || t.type === typeFilter)
    .filter((t) => currencyFilter === 'all' || t.currency === currencyFilter)
    .filter((t) => categoryFilter === 'all' || t.category === categoryFilter)
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

  const renderMoneyStack = (totals: { KWD: number; INR: number }) => {
    return (
      <>
        <span className="money-line">{formatMoney(totals.KWD, 'KWD')}</span>
        <span className="money-line secondary">{formatMoney(totals.INR, 'INR')}</span>
      </>
    );
  };

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
        <div className="summary-grid" aria-label="Monthly summary">
          <article className="metric">
            <span>Balance</span>
            <strong id="balanceValue">{renderMoneyStack(balanceTotals)}</strong>
            <small id="balanceTrend">
              {`${monthTransactions.length} ${monthTransactions.length === 1 ? 'entry' : 'entries'}`}
            </small>
          </article>
          <article className="metric">
            <span>Total Budget</span>
            <strong id="budgetTotalValue">{renderMoneyStack(budgetTotals)}</strong>
            <small id="budgetAllocated">Allocated Limits</small>
          </article>
          <article className="metric">
            <span>Actual Spent</span>
            <strong id="expenseValue">{renderMoneyStack(expenseTotals)}</strong>
            <small id="expenseCount">
              {`${expenseEntriesCount} ${expenseEntriesCount === 1 ? 'payment' : 'payments'}`}
            </small>
          </article>
          <article className="metric">
            <span>Budget Variance</span>
            <strong id="budgetLeftValue">{renderMoneyStack(budgetLeftTotals)}</strong>
            <small id="budgetStatus">{budgetStatusText}</small>
          </article>
        </div>

        {/* Charts & Budgets Panel */}
        <div className="insight-grid">
          <Charts
            transactions={monthTransactions}
            dashboardCurrency={dashboardCurrency}
            theme={theme}
          />

          {/* Budgets Panel */}
          <section className="panel budget-panel" aria-label="Budgets">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Limits</span>
                <h2>Budgets</h2>
              </div>
              <span className="panel-total" id="budgetCurrencyLabel">{dashboardCurrency} budgets</span>
            </div>
            <div id="budgetList" className="budget-list">
              {expenseCategories.map((cat) => {
                const spent = spendingMap.get(cat) || 0;
                const limit = budgets[dashboardCurrency][cat] || 0;
                const percent = limit > 0 ? Math.min((spent / limit) * 100, 140) : 0;
                const ratio = limit > 0 ? spent / limit : 0;

                let barClass = '';
                if (ratio >= 1) {
                  barClass = 'over';
                } else if (ratio >= 0.8) {
                  barClass = 'warning';
                }

                return (
                  <div key={cat} className="budget-row">
                    <div className="budget-meta">
                      <div className="budget-title">
                        <span>{cat}</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span>{`${formatMoney(spent, dashboardCurrency)} / ${formatMoney(limit, dashboardCurrency)}`}</span>
                          {limit > 0 && (
                            <span className="variance-pill" style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: ratio >= 1 ? 'rgba(196, 73, 45, 0.1)' : 'rgba(24, 114, 104, 0.1)',
                              color: ratio >= 1 ? 'var(--red)' : 'var(--green)'
                            }}>
                              {ratio >= 1 
                                ? `${formatMoney(spent - limit, dashboardCurrency)} over`
                                : `${formatMoney(limit - spent, dashboardCurrency)} left`
                              }
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="progress">
                        <span className={barClass} style={{ width: `${percent}%` }}></span>
                      </div>
                    </div>
                    <input
                      className="budget-input"
                      type="number"
                      min="0"
                      step={currencyMeta[dashboardCurrency]?.step || '0.01'}
                      value={limit || ''}
                      onChange={(e) => handleBudgetInputChange(cat, e.target.value)}
                      placeholder="0.00"
                      aria-label={`${cat} ${dashboardCurrency} budget`}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Savings Pots Panel */}
          <SavingsPots
            savingsPots={savingsPots}
            onAddPot={onAddSavingsPot}
            onDeletePot={onDeleteSavingsPot}
            onAdjustBalance={onAdjustSavingsBalance}
            dashboardCurrency={dashboardCurrency}
          />


          {/* Transactions Register */}
          <section className="panel register-panel" aria-label="Transactions">
            <div className="panel-heading register-heading">
              <div>
                <span className="eyebrow">Register</span>
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
                  placeholder="Search"
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
            </div>

            {/* Bulk Actions Toolbar (Sleek checked item manager) */}
            {selectedIds.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 16px',
                background: 'var(--blue-soft)',
                border: '1px solid var(--blue)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '13px',
                color: 'var(--text)',
                animation: 'fade-in 0.2s ease'
              }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="check" />
                  <span>{`${selectedIds.length} ${selectedIds.length === 1 ? 'item' : 'items'} selected`}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    className="button button-soft"
                    type="button"
                    onClick={() => handleBulkReconcile(true)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    title="Mark selected as reconciled (bulk check)"
                  >
                    <Icon name="check" />
                    <span>Reconcile</span>
                  </button>

                  <button
                    className="button button-soft"
                    type="button"
                    onClick={() => handleBulkReconcile(false)}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    title="Unmark selected as reconciled"
                  >
                    <span>Unreconcile</span>
                  </button>

                  <select
                    value={bulkCategory}
                    onChange={(e) => handleBulkCategoryChange(e.target.value)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      outline: 'none'
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
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Set Account...</option>
                    <option value="KNET / Debit Card">KNET / Debit Card</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>

                  <button
                    className="button button-soft danger"
                    type="button"
                    onClick={handleBulkDelete}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                  >
                    <Icon name="trash" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}

            {/* Transactions Table */}
            {filteredTransactions.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', paddingLeft: '16px', paddingRight: '0' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          aria-label="Select all transactions"
                        />
                      </th>
                      <th>Date</th>
                      <th>Details</th>
                      <th>Category</th>
                      <th>Account / Method</th>
                      <th className="amount-cell">Amount</th>
                      <th className="action-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="transactionBody">
                    {filteredTransactions.map((t) => (
                      <tr key={t.id} style={{ background: t.reconciled ? 'rgba(24, 114, 104, 0.04)' : undefined }}>
                        <td data-label="Select" style={{ paddingLeft: '16px', paddingRight: '0' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(t.id)}
                            onChange={() => handleToggleSelectRow(t.id)}
                            aria-label={`Select transaction ${t.merchant}`}
                          />
                        </td>
                        <td data-label="Date">{formatShortDate(t.date)}</td>
                        <td data-label="Details">
                          <div className="merchant-cell">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong>{t.merchant}</strong>
                              {t.reconciled && (
                                <span
                                  title="Reconciled (cleared)"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--green)',
                                    background: 'var(--green-soft)',
                                    borderRadius: '50%',
                                    width: '16px',
                                    height: '16px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    lineHeight: 1
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                            <span>{t.notes || (t.type === 'income' ? 'Income' : 'Expense')}</span>
                          </div>
                        </td>
                        <td data-label="Category">
                          <span className="category-pill">
                            <span
                              className="swatch"
                              style={{ background: categoryColors[t.category] || categoryColors.Other || '#66727f' }}
                            ></span>
                            <span>{t.category}</span>
                          </span>
                        </td>
                        <td data-label="Account">{t.account || 'KNET / Debit Card'}</td>
                        <td data-label="Amount" className={`amount-cell ${t.type}`}>
                          {`${t.type === 'expense' ? '-' : '+'}${formatMoney(t.amount, t.currency)}`}
                        </td>
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
      </div>
    </section>
  );
};
export default DashboardView;
