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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="metric-icon" style={{ width: '36px', height: '36px', fontSize: '16px', color: 'var(--blue)' }}>
            <Icon name="wallet" />
          </div>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Savings Pots</h2>
        </div>
        <span className="panel-total" style={{ color: 'var(--blue)', background: 'var(--blue-soft)' }}>
          {dashboardCurrency} goals
        </span>
      </div>

      <div className="budget-list" style={{ marginBottom: filteredPots.length > 0 ? '20px' : '0' }}>
        {filteredPots.map((pot) => {
          const percent = pot.targetAmount > 0 ? Math.min((pot.currentAmount / pot.targetAmount) * 100, 100) : 0;
          const roundedPercent = Math.round(percent);
          const isCompleted = pot.currentAmount >= pot.targetAmount;

          return (
            <div key={pot.id} className="budget-card-item">
              <div className="budget-header-row">
                <div className="budget-cat-info">
                  <div className="budget-cat-icon" style={{ background: isCompleted ? 'var(--green-soft)' : 'var(--blue-soft)', color: isCompleted ? 'var(--green-text)' : 'var(--blue-text)' }}>
                    <Icon name={isCompleted ? 'check' : 'coins'} />
                  </div>
                  <div>
                    <div className="budget-cat-name">{pot.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 600 }}>
                      {`${formatMoney(pot.currentAmount, pot.currency)} of ${formatMoney(pot.targetAmount, pot.currency)}`}
                    </div>
                  </div>
                </div>

                <span className={`variance-pill ${isCompleted ? 'left' : ''}`} style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: isCompleted ? 'var(--green-soft)' : 'var(--surface-muted)',
                  color: isCompleted ? 'var(--green-text)' : 'var(--text-secondary)'
                }}>
                  {isCompleted ? 'Goal Met! 🎉' : `${roundedPercent}%`}
                </span>
              </div>

              <div className="budget-progress-track">
                <div
                  className="budget-progress-fill"
                  style={{
                    width: `${percent}%`,
                    background: isCompleted
                      ? 'linear-gradient(90deg, var(--green), #14b8a6)'
                      : 'linear-gradient(90deg, var(--blue), #38bdf8)',
                    boxShadow: isCompleted
                      ? '0 2px 6px rgba(20, 184, 166, 0.4)'
                      : '0 2px 6px rgba(56, 189, 248, 0.4)'
                  }}
                />
              </div>

              {/* Adjust Balance and Delete Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    className="button button-soft"
                    style={{ height: '32px', padding: '0 10px', fontSize: '12px', color: 'var(--green-text)' }}
                    type="button"
                    onClick={() => startAdjustment(pot.id, 'deposit')}
                    title="Add Deposit to Savings Pot"
                  >
                    <Icon name="plus" />
                    <span>Deposit</span>
                  </button>

                  <button
                    className="button button-soft"
                    style={{ height: '32px', padding: '0 10px', fontSize: '12px', color: 'var(--red-text)' }}
                    type="button"
                    disabled={pot.currentAmount <= 0}
                    onClick={() => startAdjustment(pot.id, 'withdraw')}
                    title="Withdraw from Savings Pot"
                  >
                    <span>- Withdraw</span>
                  </button>
                </div>

                <button
                  className="icon-button danger"
                  style={{ width: '32px', height: '32px' }}
                  type="button"
                  onClick={() => onDeletePot(pot.id)}
                  title="Delete Savings Pot"
                >
                  <Icon name="trash" />
                </button>
              </div>

              {/* Inline Adjustment Form */}
              {adjustingPotId === pot.id && (
                <form onSubmit={(e) => handleAdjustSubmit(e, pot.id)} style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '10px',
                  alignItems: 'center',
                  padding: '10px',
                  background: 'var(--field)',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: 'var(--clay-inset)'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: adjustType === 'deposit' ? 'var(--green)' : 'var(--red)', textTransform: 'capitalize' }}>
                    {adjustType}:
                  </span>
                  <input
                    type="number"
                    min="0"
                    step={currencyMeta[pot.currency]?.step || '0.01'}
                    required
                    placeholder={currencyMeta[pot.currency]?.placeholder}
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    style={{ height: '32px', fontSize: '12px', width: '100px', flex: 1 }}
                    autoFocus
                  />
                  <button className="button button-primary" style={{ height: '32px', padding: '0 12px', fontSize: '12px' }} type="submit">
                    Apply
                  </button>
                  <button
                    className="button button-soft"
                    style={{ height: '32px', padding: '0 10px', fontSize: '12px' }}
                    type="button"
                    onClick={() => setAdjustingPotId(null)}
                  >
                    Cancel
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {/* New Pot Creation Card Form */}
      <form onSubmit={handleAddSubmit} style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-glass)',
        borderRadius: 'var(--radius)',
        padding: '18px',
        marginTop: '16px',
        boxShadow: 'var(--clay-shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <div className="budget-cat-icon" style={{ width: '30px', height: '30px', fontSize: '14px', background: 'var(--green-soft)', color: 'var(--green-text)' }}>
            <Icon name="plus" />
          </div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Create New Savings Pot</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Pot Name</label>
            <input
              type="text"
              maxLength={40}
              required
              placeholder="e.g. Vacation Fund, Emergency"
              value={newPotName}
              onChange={(e) => setNewPotName(e.target.value)}
              style={{ height: '38px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '10px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Target Goal</label>
              <input
                type="number"
                min="0"
                step={currentMeta.step}
                required
                placeholder={currentMeta.placeholder}
                value={newPotTarget}
                onChange={(e) => setNewPotTarget(e.target.value)}
                style={{ height: '38px', fontSize: '13px' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Currency</label>
              <select
                value={newPotCurrency}
                onChange={(e) => setNewPotCurrency(e.target.value as CurrencyCode)}
                style={{ height: '38px', fontSize: '13px' }}
              >
                <option value="KWD">KWD</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          <button
            className="button button-primary"
            type="submit"
            style={{ width: '100%', height: '38px', marginTop: '4px', fontSize: '13px' }}
          >
            <Icon name="plus" />
            <span>Create Pot</span>
          </button>
        </div>
      </form>
    </section>
  );
};
export default SavingsPots;
