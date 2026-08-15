import React, { useState, useEffect } from 'react';
import type { Transaction, TransactionType, CurrencyCode, Account, UserPreferences } from '../types';
import {
  currencyMeta,
  expenseCategories,
  incomeCategories,
  defaultEntryDate,
  getPaymentModesForCurrency
} from '../utils';
import Icon from './Icon';

interface EntryPanelProps {
  month: string;
  editingTransaction: Transaction | null;
  onCancelEdit: () => void;
  onSubmit: (transaction: Omit<Transaction, 'id'> & { id?: string }) => void;
  transactionCurrency: CurrencyCode;
  onTransactionCurrencyChange: (currency: CurrencyCode) => void;
  hideOnMobile?: boolean;
  onClose?: () => void;
  accounts?: Account[];
  selectedAccount?: string;
  activeUserId?: string;
  userPreferences?: UserPreferences;
  permissions?: {
    savingsPots?: boolean;
    budgets?: boolean;
    transactions?: boolean;
    multiAccount?: boolean;
  };
  onAddAccount?: (name: string, type?: Account['type'], currency?: CurrencyCode) => void;
}

const MONTHS = [
  { value: '01', name: 'Jan' },
  { value: '02', name: 'Feb' },
  { value: '03', name: 'Mar' },
  { value: '04', name: 'Apr' },
  { value: '05', name: 'May' },
  { value: '06', name: 'Jun' },
  { value: '07', name: 'Jul' },
  { value: '08', name: 'Aug' },
  { value: '09', name: 'Sep' },
  { value: '10', name: 'Oct' },
  { value: '11', name: 'Nov' },
  { value: '12', name: 'Dec' }
];

export const EntryPanel: React.FC<EntryPanelProps> = ({
  month,
  editingTransaction,
  onCancelEdit,
  onSubmit,
  transactionCurrency,
  onTransactionCurrencyChange,
  hideOnMobile,
  onClose,
  accounts = [],
  selectedAccount,
  activeUserId,
  userPreferences,
  onAddAccount,
}) => {
  const [entryType, setEntryType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(transactionCurrency);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(defaultEntryDate(month));
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState(accounts[0]?.name || '');
  const [paymentMode, setPaymentMode] = useState<string>(
    userPreferences?.defaultKwdPaymentMode || 'Cash'
  );
  const [notes, setNotes] = useState('');
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccCurrency, setNewAccCurrency] = useState<CurrencyCode>(transactionCurrency);

  // Helper to resolve preferred payment mode for given currency
  const getPreferredPaymentMode = (curr: CurrencyCode) => {
    const prefs = userPreferences || {};
    if (curr === 'INR') {
      return prefs.defaultInrPaymentMode || 'UPI';
    }
    return prefs.defaultKwdPaymentMode || prefs.defaultPaymentMode || 'Cash';
  };

  // Auto-set default account when accounts list updates
  useEffect(() => {
    if (!editingTransaction && accounts.length > 0 && !accounts.some((a) => a.name === account)) {
      setAccount(accounts[0].name);
    }
  }, [accounts, editingTransaction]);

  // Auto-sync account state when parent selectedAccount changes
  useEffect(() => {
    if (!editingTransaction && selectedAccount && selectedAccount !== 'all') {
      const match = accounts.find((a) => a.name === selectedAccount);
      if (match) {
        setAccount(match.name);
      }
    }
  }, [selectedAccount, accounts, editingTransaction]);

  // Auto-sync account dropdown selection to match active currency
  useEffect(() => {
    if (!editingTransaction && currency && accounts.length > 0) {
      const currentAccObj = accounts.find((a) => a.name === account);
      if (!currentAccObj || currentAccObj.currency !== currency) {
        const matchingAcc = accounts.find((a) => a.currency === currency);
        if (matchingAcc) {
          setAccount(matchingAcc.name);
        }
      }
    }
  }, [currency, accounts, editingTransaction]);

  // Auto-sync currency & payment mode when account selection changes
  useEffect(() => {
    if (!editingTransaction && account) {
      const selectedAccObj = accounts.find((a) => a.name === account);
      if (selectedAccObj && selectedAccObj.currency) {
        const accCurr = selectedAccObj.currency;
        if (currency !== accCurr) {
          setCurrency(accCurr);
          onTransactionCurrencyChange(accCurr);
          setPaymentMode(getPreferredPaymentMode(accCurr));
        }
      }
    }
  }, [account, accounts, currency, editingTransaction, userPreferences]);

  // Auto-sync currency state when transactionCurrency prop changes from parent
  useEffect(() => {
    if (!editingTransaction && transactionCurrency) {
      setCurrency(transactionCurrency);
      setPaymentMode(getPreferredPaymentMode(transactionCurrency));
    }
  }, [transactionCurrency, editingTransaction, userPreferences]);

  // Handle editing mode change
  useEffect(() => {
    if (editingTransaction) {
      setEntryType(editingTransaction.type);
      setAmount(String(editingTransaction.amount));
      setCurrency(editingTransaction.currency);
      onTransactionCurrencyChange(editingTransaction.currency);
      setMerchant(editingTransaction.merchant);
      setDate(editingTransaction.date);
      setCategory(editingTransaction.category);
      setAccount(editingTransaction.account || accounts[0]?.name || '');
      setPaymentMode(editingTransaction.paymentMode || getPreferredPaymentMode(editingTransaction.currency));
      setNotes(editingTransaction.notes || '');
    } else {
      resetForm();
    }
  }, [editingTransaction]);

  // Keep date in month
  useEffect(() => {
    if (!editingTransaction) {
      setDate(defaultEntryDate(month));
    }
  }, [month, editingTransaction]);

  // Dynamic category options based on transaction type
  const categories = entryType === 'income' ? incomeCategories : expenseCategories;

  // Set default category when type changes
  useEffect(() => {
    if (!editingTransaction) {
      const prefs = userPreferences || {};
      if (entryType === 'expense') {
        const defExp = prefs.defaultExpenseCategory || prefs.defaultCategory;
        if (defExp && expenseCategories.includes(defExp)) {
          setCategory(defExp);
          return;
        }
      } else if (entryType === 'income') {
        const defInc = prefs.defaultIncomeCategory;
        if (defInc && incomeCategories.includes(defInc)) {
          setCategory(defInc);
          return;
        }
      }
      if (categories.length > 0 && !categories.includes(category)) {
        setCategory(categories[0]);
      }
    }
  }, [entryType, userPreferences]);

  // Keep payment mode & account updated based on user preferences and selected currency
  useEffect(() => {
    if (!editingTransaction) {
      setPaymentMode(getPreferredPaymentMode(currency));
      const prefs = userPreferences || {};
      const prefAcc = prefs.defaultDisplayAccount;
      if (prefAcc && prefAcc !== 'all' && accounts.some((a) => a.name === prefAcc)) {
        setAccount(prefAcc);
      } else if (accounts.length > 0 && !accounts.some((a) => a.name === account)) {
        setAccount(accounts[0].name);
      }
    }
  }, [currency, accounts, activeUserId, editingTransaction, userPreferences]);

  const resetForm = () => {
    setEntryType('expense');
    setAmount('');
    setMerchant('');
    setDate(defaultEntryDate(month));

    const prefs = userPreferences || {};
    const defExp = prefs.defaultExpenseCategory || prefs.defaultCategory;
    if (defExp && expenseCategories.includes(defExp)) {
      setCategory(defExp);
    } else {
      setCategory(expenseCategories[0]);
    }

    setPaymentMode(getPreferredPaymentMode(currency));

    const prefAcc = prefs.defaultDisplayAccount;
    if (prefAcc && prefAcc !== 'all' && accounts.some((a) => a.name === prefAcc)) {
      setAccount(prefAcc);
    } else if (accounts.length > 0) {
      setAccount(accounts[0].name);
    } else {
      setAccount('');
    }

    setNotes('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return;
    }

    if (!merchant.trim() || !date) {
      return;
    }

    const finalCategory = category && category.trim() ? category.trim() : 'Other';

    onSubmit({
      id: editingTransaction?.id,
      type: entryType,
      currency,
      amount: parsedAmount,
      merchant: merchant.trim(),
      date,
      category: finalCategory,
      account,
      notes: notes.trim()
    });

    if (!editingTransaction) {
      resetForm();
    }
    if (onClose) {
      onClose();
    }
  };

  const handleEntryTypeChange = (type: TransactionType) => {
    setEntryType(type);
  };

  const handleCurrencyChange = (curr: CurrencyCode) => {
    setCurrency(curr);
    onTransactionCurrencyChange(curr);
  };

  const isIncome = entryType === 'income';
  const currentMeta = currencyMeta[currency];

  // Parse YYYY-MM-DD
  const selectedYear = date ? date.slice(0, 4) : new Date().getFullYear().toString();
  const selectedMonth = date ? date.slice(5, 7) : (new Date().getMonth() + 1).toString().padStart(2, '0');
  const selectedDay = date ? date.slice(8, 10) : new Date().getDate().toString().padStart(2, '0');

  // Generate Year option list (current year +/- 3)
  const currentYearNum = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => String(currentYearNum - 3 + i));

  // Generate Day option list based on selected Year/Month
  const maxDays = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
  const days = Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0'));

  const handleDateDropdownChange = (type: 'day' | 'month' | 'year', value: string) => {
    let y = selectedYear;
    let m = selectedMonth;
    let d = selectedDay;

    if (type === 'year') y = value;
    if (type === 'month') m = value;
    if (type === 'day') d = value;

    // Validate day boundary on month transition (e.g. Feb 31 -> Feb 28)
    const newMaxDays = new Date(Number(y), Number(m), 0).getDate();
    if (Number(d) > newMaxDays) {
      d = String(newMaxDays).padStart(2, '0');
    }

    setDate(`${y}-${m}-${d}`);
  };

  return (
    <aside className={`sidebar-aside entry-sidebar ${hideOnMobile ? 'hidden-mobile' : ''}`} aria-label="Transaction entry">
      <div className="panel-heading">
        <div>
          <h2>{editingTransaction ? 'Edit Entry' : 'Add Entry'}</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {editingTransaction && (
            <button
              className="button button-soft"
              type="button"
              onClick={onCancelEdit}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
          {onClose && (
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              title="Close form"
              style={{ width: '32px', height: '32px', minHeight: '32px' }}
            >
              <Icon name="x" />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} id="transactionForm" className="entry-form" style={{ marginTop: '16px' }}>
        <div className="segmented" aria-label="Transaction type">
          <button
            className={`segment ${entryType === 'expense' ? 'active' : ''}`}
            type="button"
            onClick={() => handleEntryTypeChange('expense')}
          >
            Expense
          </button>
          <button
            className={`segment ${entryType === 'income' ? 'active' : ''}`}
            type="button"
            onClick={() => handleEntryTypeChange('income')}
          >
            Income
          </button>
        </div>

        <label className="field" htmlFor="amountInput">
          <span>Amount</span>
          <div className="amount-grid">
            <div className="money-field">
              <span id="currencySymbol">{currency}</span>
              <input
                id="amountInput"
                type="number"
                min="0"
                step={currentMeta.step}
                inputMode="decimal"
                required
                placeholder={currentMeta.placeholder}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <select
              id="currencyInput"
              aria-label="Transaction currency"
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value as CurrencyCode)}
            >
              <option value="KWD">KWD</option>
              <option value="INR">INR</option>
            </select>
          </div>
        </label>

        <label className="field" htmlFor="merchantInput">
          <span id="merchantLabel">{isIncome ? 'Received from' : 'Paid to'}</span>
          <input
            id="merchantInput"
            type="text"
            maxLength={64}
            required
            placeholder={isIncome ? 'Employer, client, bank' : 'Shop, person, company'}
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
          />
        </label>

        {/* Date Dropdown Selectors */}
        <div className="field">
          <span>Date</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '8px' }}>
            <select
              id="dateDayInput"
              aria-label="Day"
              value={selectedDay}
              onChange={(e) => handleDateDropdownChange('day', e.target.value)}
              style={{ minWidth: '0' }}
            >
              {days.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              id="dateMonthInput"
              aria-label="Month"
              value={selectedMonth}
              onChange={(e) => handleDateDropdownChange('month', e.target.value)}
              style={{ minWidth: '0' }}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>{m.name}</option>
              ))}
            </select>

            <select
              id="dateYearInput"
              aria-label="Year"
              value={selectedYear}
              onChange={(e) => handleDateDropdownChange('year', e.target.value)}
              style={{ minWidth: '0' }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Separate Account, Payment Mode, and Category fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <label className="field" htmlFor="accountInput">
              <span>Account</span>
              <select
                id="accountInput"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {(accounts || []).length === 0 && (
                  <option value="">-- Select Account --</option>
                )}
                {(accounts || []).map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name} ({acc.currency || 'KWD'})
                  </option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="paymentModeInput">
              <span>Payment Mode</span>
              <select
                id="paymentModeInput"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                {getPaymentModesForCurrency(currency, accounts).map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field" htmlFor="categoryInput">
            <span>Category / Head (Optional)</span>
            <select
              id="categoryInput"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">(None / Optional)</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Quick Add Account Modal */}
        {showAddAccountModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(7, 9, 12, 0.45)',
            backdropFilter: 'blur(10px)',
            zIndex: 12000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-strong)',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: 700 }}>Add New Account</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--muted)' }}>
                Create a custom account to track expenses separately (e.g. NBK Checking, Boubyan Savings, Cash Wallet).
              </p>
              <label className="field" htmlFor="newAccNameInput" style={{ marginBottom: '12px' }}>
                <span>Account Name</span>
                <input
                  id="newAccNameInput"
                  type="text"
                  placeholder="e.g. Boubyan Salary, Amex Card"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="field" htmlFor="newAccCurrencyInput" style={{ marginBottom: '16px' }}>
                <span>Currency Type</span>
                <select
                  id="newAccCurrencyInput"
                  value={newAccCurrency}
                  onChange={(e) => setNewAccCurrency(e.target.value as CurrencyCode)}
                >
                  <option value="KWD">KWD</option>
                  <option value="INR">INR</option>
                </select>
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="button button-soft"
                  onClick={() => { setShowAddAccountModal(false); setNewAccountName(''); }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    if (newAccountName.trim() && onAddAccount) {
                      onAddAccount(newAccountName.trim(), 'checking', newAccCurrency);
                      setAccount(newAccountName.trim());
                      setNewAccountName('');
                      setShowAddAccountModal(false);
                    }
                  }}
                  style={{ flex: 1 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        <label className="field" htmlFor="notesInput">
          <span>Details</span>
          <textarea
            id="notesInput"
            rows={3}
            maxLength={220}
            placeholder="Salary month, invoice, bill number, or anything useful"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        <button className="button button-primary submit-button" type="submit">
          <Icon name={editingTransaction ? 'edit' : 'plus'} />
          <span id="submitLabel">{editingTransaction ? 'Save entry' : 'Add transaction'}</span>
        </button>
      </form>
    </aside>
  );
};
export default EntryPanel;
