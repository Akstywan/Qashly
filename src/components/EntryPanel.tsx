import React, { useState, useEffect } from 'react';
import type { Transaction, TransactionType, CurrencyCode } from '../types';
import {
  currencyMeta,
  expenseCategories,
  incomeCategories,
  defaultEntryDate
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
}) => {
  const [entryType, setEntryType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(transactionCurrency);
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(defaultEntryDate(month));
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('KNET / Debit Card');
  const [notes, setNotes] = useState('');

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
      setAccount(editingTransaction.account || 'KNET / Debit Card');
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
    if (categories.length > 0 && !categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [entryType, category]);

  const resetForm = () => {
    setEntryType('expense');
    setAmount('');
    setMerchant('');
    setDate(defaultEntryDate(month));
    setCategory(expenseCategories[0]);
    setAccount('KNET / Debit Card');
    setNotes('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amount);

    if (!parsedAmount || parsedAmount <= 0) {
      return;
    }

    if (!merchant.trim() || !date || !category) {
      return;
    }

    onSubmit({
      id: editingTransaction?.id,
      type: entryType,
      currency,
      amount: parsedAmount,
      merchant: merchant.trim(),
      date,
      category,
      account,
      notes: notes.trim()
    });

    if (!editingTransaction) {
      resetForm();
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
          <span className="eyebrow">{editingTransaction ? 'Modify' : 'New ledger record'}</span>
          <h2>{editingTransaction ? 'Edit Entry' : 'Add Entry'}</h2>
        </div>
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

        {/* Category and Account / Method paired in row */}
        <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <label className="field" htmlFor="categoryInput">
            <span>Category</span>
            <select
              id="categoryInput"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <label className="field" htmlFor="accountInput">
            <span>Account / method</span>
            <select
              id="accountInput"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option>KNET / Debit Card</option>
              <option>Credit Card</option>
              <option>Cash</option>
              <option>Bank Transfer</option>
              <option>UPI</option>
              <option>Salary Account</option>
              <option>Savings</option>
              <option>Wallet</option>
            </select>
          </label>
        </div>

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
