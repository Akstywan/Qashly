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
  const [selectedAccount, setSelectedAccount] = useState<string>(userAccounts[0]?.name || '');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Net balance for source month
  const netBalance = calculateMonthNetBalance(transactions, sourceMonthKey, currency);

  useEffect(() => {
    setCurrency(defaultCurrency);
    setSourceMonthKey(getPreviousMonthKey(currentMonthKey));
    setTargetMonthKey(currentMonthKey);
    if (userAccounts.length > 0 && !userAccounts.some((a) => a.name === selectedAccount)) {
      setSelectedAccount(userAccounts[0].name);
    }
  }, [currentMonthKey, defaultCurrency, isOpen, userAccounts]);

  useEffect(() => {
    const net = calculateMonthNetBalance(transactions, sourceMonthKey, currency);
    const positiveNet = Math.max(0, net);
    const decimals = currencyMeta[currency]?.decimals ?? 3;
    setAmountInput(positiveNet > 0 ? positiveNet.toFixed(decimals) : '');
    setNotes(`Balance rollover from ${formatMonthLabel(sourceMonthKey)}`);
  }, [sourceMonthKey, currency, transactions]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(amountInput);
    if (isNaN(num) || num <= 0) {
      alert('Please enter a valid positive amount to transfer.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirmRollover({
        sourceMonth: sourceMonthKey,
        targetMonth: targetMonthKey,
        currency,
        amount: num,
        account: selectedAccount,
        paymentMode: selectedAccount,
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
        padding: '20px',
        animation: 'fade-in 0.25s ease'
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: '24px',
          padding: '28px 24px',
          maxWidth: '480px',
          width: '100%',
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
                min="0.001"
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

            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Deposit Account</span>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
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
