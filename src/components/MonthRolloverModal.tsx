import React, { useState, useEffect } from 'react';
import type { CurrencyCode, Account } from '../types';
import {
  formatMonthLabel,
  getPreviousMonthKey,
  calculateMonthNetBalance,
  formatMoney,
  currencyMeta
} from '../utils';

interface MonthRolloverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRollover: (params: {
    sourceMonth: string;
    targetMonth: string;
    currency: CurrencyCode;
    amount: number;
    account: string;
    paymentMode: string;
    notes: string;
  }) => Promise<void>;
  onDismissMonth: (targetMonth: string) => void;
  currentMonthKey: string;
  transactions: any[];
  userAccounts?: Account[];
  defaultCurrency?: CurrencyCode;
}

export const MonthRolloverModal: React.FC<MonthRolloverModalProps> = ({
  isOpen,
  onClose,
  onConfirmRollover,
  onDismissMonth,
  currentMonthKey,
  transactions,
  userAccounts = [],
  defaultCurrency = 'KWD'
}) => {
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);
  const [sourceMonthKey, setSourceMonthKey] = useState<string>(getPreviousMonthKey(currentMonthKey));
  const [targetMonthKey, setTargetMonthKey] = useState<string>(currentMonthKey);
  const [amountInput, setAmountInput] = useState<string>('');
  const [sourceAccount, setSourceAccount] = useState<string>('all');
  const [targetAccount, setTargetAccount] = useState<string>(userAccounts[0]?.name || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto-sync currency when source account changes
  useEffect(() => {
    if (sourceAccount && sourceAccount !== 'all') {
      const matchAcc = userAccounts.find((a) => a.name === sourceAccount);
      if (matchAcc && matchAcc.currency && matchAcc.currency !== currency) {
        setCurrency(matchAcc.currency);
      }
    }
  }, [sourceAccount, userAccounts]);

  // Net balance for source month and source account
  const netBalance = calculateMonthNetBalance(transactions, sourceMonthKey, currency, sourceAccount);

  useEffect(() => {
    setCurrency(defaultCurrency);
    setSourceMonthKey(getPreviousMonthKey(currentMonthKey));
    setTargetMonthKey(currentMonthKey);
    if (userAccounts.length > 0) {
      if (!userAccounts.some((a) => a.name === targetAccount)) {
        setTargetAccount(userAccounts[0].name);
      }
    }
  }, [currentMonthKey, defaultCurrency, isOpen, userAccounts]);

  useEffect(() => {
    const net = calculateMonthNetBalance(transactions, sourceMonthKey, currency, sourceAccount);
    const positiveNet = Math.max(0, net);
    const decimals = currencyMeta[currency]?.decimals ?? 3;
    setAmountInput(positiveNet > 0 ? positiveNet.toFixed(decimals) : '');
    setNotes(`Balance rollover from ${formatMonthLabel(sourceMonthKey)}`);
  }, [sourceMonthKey, currency, sourceAccount, transactions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amountInput);
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid positive amount to transfer.');
      return;
    }

    const finalTargetAccount = targetAccount || userAccounts[0]?.name || 'Kuwait Cash Account';

    setIsSubmitting(true);
    try {
      await onConfirmRollover({
        sourceMonth: sourceMonthKey,
        targetMonth: targetMonthKey,
        currency,
        amount: num,
        account: finalTargetAccount,
        paymentMode: finalTargetAccount,
        notes: notes.trim() || `Balance rollover from ${formatMonthLabel(sourceMonthKey)}`
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    onDismissMonth(targetMonthKey);
    onClose();
  };

  const decimals = currencyMeta[currency]?.decimals ?? 3;
  const stepVal = currencyMeta[currency]?.step ?? '0.001';

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(7, 9, 12, 0.65)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10500,
        padding: '16px',
        animation: 'fade-in 0.25s ease'
      }}
      onClick={onClose}
    >
      <div
        className="modal-content rollover-modal-content animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '24px',
          padding: '24px 20px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: 'var(--text)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Month-End Automation</span>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800 }}>Balance Transfer</h2>
          </div>
          <button
            type="button"
            className="button button-soft"
            onClick={onClose}
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Close
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
          Rollover leftover unspent funds from a previous month into a new month.
        </p>

        {/* Currency & Source Month controls */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <label className="field">
            <span>Currency</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`button ${currency === 'KWD' ? 'button-primary' : 'button-soft'}`}
                onClick={() => setCurrency('KWD')}
                style={{ flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 700 }}
              >
                KWD
              </button>
              <button
                type="button"
                className={`button ${currency === 'INR' ? 'button-primary' : 'button-soft'}`}
                onClick={() => setCurrency('INR')}
                style={{ flex: 1, padding: '8px 0', fontSize: '12px', fontWeight: 700 }}
              >
                INR
              </button>
            </div>
          </label>

          <label className="field">
            <span>Source Month</span>
            <input
              type="month"
              value={sourceMonthKey}
              onChange={(e) => setSourceMonthKey(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-glass)',
                background: 'var(--field)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </label>
        </div>

        {/* Net Surplus Card */}
        <div
          style={{
            padding: '14px 16px',
            borderRadius: '14px',
            background: netBalance > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${netBalance > 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {formatMonthLabel(sourceMonthKey)} Surplus:
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace' }}>
              {formatMoney(netBalance, currency)}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {netBalance > 0
              ? `You have unspent funds from ${formatMonthLabel(sourceMonthKey)} available to carry forward.`
              : `No net surplus detected for ${formatMonthLabel(sourceMonthKey)}.`}
          </span>
        </div>

        {/* Form fields */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field">
              <span>Target Month</span>
              <input
                type="month"
                value={targetMonthKey}
                onChange={(e) => setTargetMonthKey(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none'
                }}
                required
              />
            </label>

            <label className="field">
              <span>Rollover Amount ({currency})</span>
              <input
                type="number"
                step={stepVal}
                min={stepVal}
                placeholder={`0.${'0'.repeat(decimals)}`}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  fontWeight: 700,
                  outline: 'none'
                }}
                required
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label className="field">
              <span>Source Account</span>
              <select
                value={sourceAccount}
                onChange={(e) => {
                  const newSource = e.target.value;
                  setSourceAccount(newSource);
                  if (newSource && newSource !== 'all') {
                    const matchAcc = userAccounts.find((a) => a.name === newSource);
                    if (matchAcc && matchAcc.currency) {
                      setCurrency(matchAcc.currency);
                    }
                    setTargetAccount(newSource);
                  }
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="all">All Accounts ({currency})</option>
                {userAccounts.map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name} ({acc.currency || 'KWD'})
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Deposit Account</span>
              <select
                value={targetAccount}
                onChange={(e) => setTargetAccount(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--field)',
                  color: 'var(--text)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                {userAccounts.length === 0 && (
                  <option value="">-- Select Account --</option>
                )}
                {userAccounts.map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name} ({acc.currency || 'KWD'})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Notes / Description</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Carry forward surplus"
              style={{
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-glass)',
                background: 'var(--field)',
                color: 'var(--text)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </label>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              onClick={handleDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '6px 8px'
              }}
            >
              Dismiss for {formatMonthLabel(targetMonthKey)}
            </button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="button button-soft"
                onClick={onClose}
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={isSubmitting || !amountInput || Number(amountInput) <= 0}
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 700 }}
              >
                {isSubmitting ? 'Transferring...' : 'Transfer Balance'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MonthRolloverModal;
