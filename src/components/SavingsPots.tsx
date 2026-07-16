import React, { useState } from 'react';
import type { SavingsPot, CurrencyCode } from '../types';
import { formatMoney, currencyMeta } from '../utils';
import Icon from './Icon';

interface SavingsPotsProps {
  savingsPots: SavingsPot[];
  onAddPot: (name: string, targetAmount: number, currency: CurrencyCode) => void;
  onDeletePot: (id: string) => void;
  onAdjustBalance: (id: string, amount: number) => void;
  dashboardCurrency: CurrencyCode;
}

export const SavingsPots: React.FC<SavingsPotsProps> = ({
  savingsPots,
  onAddPot,
  onDeletePot,
  onAdjustBalance,
  dashboardCurrency,
}) => {
  // New pot state
  const [newPotName, setNewPotName] = useState('');
  const [newPotTarget, setNewPotTarget] = useState('');
  const [newPotCurrency, setNewPotCurrency] = useState<CurrencyCode>(dashboardCurrency);

  // Inline adjustment state
  const [adjustingPotId, setAdjustingPotId] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<'deposit' | 'withdraw'>('deposit');
  const [adjustAmount, setAdjustAmount] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = Number(newPotTarget);
    if (!newPotName.trim() || !target || target <= 0) {
      return;
    }
    onAddPot(newPotName.trim(), target, newPotCurrency);
    setNewPotName('');
    setNewPotTarget('');
  };

  const handleAdjustSubmit = (e: React.FormEvent, potId: string) => {
    e.preventDefault();
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) return;

    // Withdraw is negative balance change
    const delta = adjustType === 'withdraw' ? -amount : amount;
    onAdjustBalance(potId, delta);

    // Reset inline adjustment state
    setAdjustingPotId(null);
    setAdjustAmount('');
  };

  const startAdjustment = (potId: string, type: 'deposit' | 'withdraw') => {
    setAdjustingPotId(potId);
    setAdjustType(type);
    setAdjustAmount('');
  };

  // Filter pots to only show matching currency to dashboard or show all
  const filteredPots = savingsPots.filter((pot) => pot.currency === dashboardCurrency);
  const currentMeta = currencyMeta[dashboardCurrency] || currencyMeta.KWD;

  return (
    <section className="panel budget-panel" aria-label="Savings Pots">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Savings Goal</span>
          <h2>Savings Pots</h2>
        </div>
        <span className="panel-total">{dashboardCurrency} goals</span>
      </div>

      <div className="budget-list" style={{ marginBottom: filteredPots.length > 0 ? '24px' : '0' }}>
        {filteredPots.map((pot) => {
          const percent = pot.targetAmount > 0 ? Math.min((pot.currentAmount / pot.targetAmount) * 100, 100) : 0;
          const roundedPercent = Math.round(percent);
          const isCompleted = pot.currentAmount >= pot.targetAmount;

          return (
            <div key={pot.id} className="budget-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '16px' }}>
              <div className="budget-meta">
                <div className="budget-title" style={{ fontSize: '15px' }}>
                  <span>{pot.name}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ color: isCompleted ? 'var(--green)' : 'var(--muted)' }}>
                      {`${formatMoney(pot.currentAmount, pot.currency)} / ${formatMoney(pot.targetAmount, pot.currency)} (${roundedPercent}%)`}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: isCompleted ? 'rgba(24, 114, 104, 0.1)' : 'rgba(102, 114, 127, 0.1)',
                      color: isCompleted ? 'var(--green)' : 'var(--muted)'
                    }}>
                      {isCompleted 
                        ? 'Goal Met! 🎉' 
                        : `${formatMoney(pot.targetAmount - pot.currentAmount, pot.currency)} left`
                      }
                    </span>
                  </div>
                </div>
                <div className="progress">
                  <span className={isCompleted ? 'over' : ''} style={{ width: `${percent}%` }}></span>
                </div>

                {/* Inline Adjustment Form */}
                {adjustingPotId === pot.id && (
                  <form onSubmit={(e) => handleAdjustSubmit(e, pot.id)} style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: adjustType === 'deposit' ? 'var(--green)' : 'var(--red)', textTransform: 'capitalize' }}>
                      {adjustType}:
                    </span>
                    <input
                      className="budget-input"
                      style={{ width: '90px', minHeight: '32px', textAlign: 'left' }}
                      type="number"
                      min="0"
                      step={currencyMeta[pot.currency]?.step || '0.01'}
                      required
                      placeholder={currencyMeta[pot.currency]?.placeholder}
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      autoFocus
                    />
                    <button className="button button-primary" style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }} type="submit">
                      Apply
                    </button>
                    <button
                      className="button button-soft"
                      style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px', borderColor: 'var(--border)' }}
                      type="button"
                      onClick={() => setAdjustingPotId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>

              {/* Adjust Balance and Delete Actions */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  className="icon-button"
                  style={{ width: '32px', height: '32px', borderColor: 'var(--green-soft)', color: 'var(--green)' }}
                  type="button"
                  onClick={() => startAdjustment(pot.id, 'deposit')}
                  title="Add Savings"
                >
                  <Icon name="plus" />
                </button>
                <button
                  className="icon-button"
                  style={{ width: '32px', height: '32px', borderColor: 'var(--red-soft)', color: 'var(--red)' }}
                  type="button"
                  disabled={pot.currentAmount <= 0}
                  onClick={() => startAdjustment(pot.id, 'withdraw')}
                  title="Withdraw Savings"
                >
                  <span style={{ fontSize: '18px', fontWeight: 800 }}>-</span>
                </button>
                <button
                  className="icon-button danger"
                  style={{ width: '32px', height: '32px' }}
                  type="button"
                  onClick={() => confirm(`Delete pot "${pot.name}"?`) && onDeletePot(pot.id)}
                  title="Delete Pot"
                >
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Pot Inline Creation Card Form */}
      <form onSubmit={handleAddSubmit} style={{
        background: 'var(--row-hover)',
        border: '1px dashed var(--border-glass)',
        borderRadius: '12px',
        padding: '16px',
        marginTop: '16px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700 }}>Create New Savings Pot</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 90px auto', gap: '8px', alignItems: 'end' }}>
          <label className="field" style={{ gap: '4px' }}>
            <span style={{ fontSize: '11px' }}>Pot Name</span>
            <input
              style={{ minHeight: '34px', padding: '6px 10px' }}
              type="text"
              maxLength={40}
              required
              placeholder="e.g. Vacation Fund"
              value={newPotName}
              onChange={(e) => setNewPotName(e.target.value)}
            />
          </label>
          <label className="field" style={{ gap: '4px' }}>
            <span style={{ fontSize: '11px' }}>Target Goal</span>
            <input
              style={{ minHeight: '34px', padding: '6px 10px' }}
              type="number"
              min="0"
              step={currentMeta.step}
              required
              placeholder={currentMeta.placeholder}
              value={newPotTarget}
              onChange={(e) => setNewPotTarget(e.target.value)}
            />
          </label>
          <label className="field" style={{ gap: '4px' }}>
            <span style={{ fontSize: '11px' }}>Currency</span>
            <select
              style={{ minHeight: '34px', padding: '6px 10px' }}
              value={newPotCurrency}
              onChange={(e) => setNewPotCurrency(e.target.value as CurrencyCode)}
            >
              <option value="KWD">KWD</option>
              <option value="INR">INR</option>
            </select>
          </label>
          <button className="button button-primary" style={{ minHeight: '34px' }} type="submit">
            Create Pot
          </button>
        </div>
      </form>
    </section>
  );
};
export default SavingsPots;
