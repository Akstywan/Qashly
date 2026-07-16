import React, { useState } from 'react';
import type { User, UserLedger } from '../types';
import { formatMoney, hashPassword, createId } from '../utils';
import Icon from './Icon';

interface AdminViewProps {
  users: User[];
  userData: Record<string, UserLedger>;
  onOpenUserLedger: (userId: string) => void;
  onResetUserLedger: (userId: string) => void;
  onCreateUser: (user: User) => Promise<void>;
}



export const AdminView: React.FC<AdminViewProps> = ({
  users,
  userData,
  onOpenUserLedger,
  onResetUserLedger,
  onCreateUser
}) => {
  // Local state for Create User form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  
  // Reusable custom premium alert modal popup state
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    text: string;
    tone: 'success' | 'error' | 'info';
  }>({ show: false, title: '', text: '', tone: 'info' });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Aggregate system-wide metrics
  const getSystemTotals = () => {
    const income = { KWD: 0, INR: 0 };
    const expense = { KWD: 0, INR: 0 };
    let transactionCount = 0;

    users.forEach((user) => {
      const ledger = userData[user.id] || { transactions: [], budgets: {} };
      transactionCount += ledger.transactions.length;

      ledger.transactions.forEach((t) => {
        if (t.type === 'income') {
          income[t.currency] += t.amount;
        } else {
          expense[t.currency] += t.amount;
        }
      });
    });

    return { income, expense, transactionCount };
  };

  const { income: sysIncome, expense: sysExpense, transactionCount: sysTxCount } = getSystemTotals();

  // Render money stack helper
  const renderMoneyStack = (totals: { KWD: number; INR: number }) => {
    return (
      <>
        <span className="money-line">{formatMoney(totals.KWD, 'KWD')}</span>
        <span className="money-line secondary">{formatMoney(totals.INR, 'INR')}</span>
      </>
    );
  };

  // Get user-specific metrics
  const getUserMetrics = (userId: string) => {
    const ledger = userData[userId] || { transactions: [] };
    const txCount = ledger.transactions.length;
    const totals = {
      income: { KWD: 0, INR: 0 },
      expense: { KWD: 0, INR: 0 }
    };

    ledger.transactions.forEach((t) => {
      if (t.type === 'income') {
        totals.income[t.currency] += t.amount;
      } else {
        totals.expense[t.currency] += t.amount;
      }
    });

    return { txCount, totals };
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim().toLowerCase();
    if (!name.trim() || !cleanUsername || !password) {
      setAlertModal({
        show: true,
        title: 'Validation Error',
        text: 'Please fill in all fields.',
        tone: 'error'
      });
      return;
    }

    if (users.some((u) => u.username === cleanUsername)) {
      setAlertModal({
        show: true,
        title: 'Username Taken',
        text: 'A user with this username already exists.',
        tone: 'error'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const passwordHash = await hashPassword(cleanUsername, password);

      const newUser: User = {
        id: createId(),
        name: name.trim(),
        username: cleanUsername,
        role,
        passwordHash,
        securityQuestion: '',
        securityAnswerHash: '',
        createdAt: new Date().toISOString()
      };

      await onCreateUser(newUser);
      
      // Reset form
      setName('');
      setUsername('');
      setPassword('');
      setRole('user');

      setAlertModal({
        show: true,
        title: 'User Created',
        text: 'The new user account has been registered successfully.',
        tone: 'success'
      });

      setShowCreateForm(false);
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Error Creating User',
        text: 'Failed to create user. Please try again.',
        tone: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section className="admin-view" id="adminView" aria-label="Admin portal">
        {/* Metric Cards Summary */}
        <div className="summary-grid admin-summary" aria-label="Admin summary">
          <article className="metric">
            <span>Users</span>
            <strong id="adminUserCount">{users.length}</strong>
            <small>Local accounts</small>
          </article>
          <article className="metric">
            <span>Transactions</span>
            <strong id="adminTransactionCount">{sysTxCount}</strong>
            <small>All users</small>
          </article>
          <article className="metric">
            <span>Total income</span>
            <strong id="adminIncomeValue">{renderMoneyStack(sysIncome)}</strong>
            <small>KWD and INR</small>
          </article>
          <article className="metric">
            <span>Total spending</span>
            <strong id="adminExpenseValue">{renderMoneyStack(sysExpense)}</strong>
            <small>KWD and INR</small>
          </article>
        </div>

        {/* Conditionally Render Create User Form Panel */}
        {showCreateForm ? (
          <section className="panel" style={{ marginBottom: '24px' }}>
            <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="eyebrow">User Management</span>
                <h2>Create New Account</h2>
              </div>
              <button
                className="button button-soft"
                type="button"
                onClick={() => setShowCreateForm(false)}
              >
                <Icon name="x" />
                <span>Cancel</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
              <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label className="field" htmlFor="adminCreateName">
                  <span>Full Name</span>
                  <input
                    id="adminCreateName"
                    type="text"
                    placeholder="e.g. John Doe"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <label className="field" htmlFor="adminCreateUsername">
                  <span>Username</span>
                  <input
                    id="adminCreateUsername"
                    type="text"
                    placeholder="e.g. johndoe"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </label>
              </div>

              <div className="field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label className="field" htmlFor="adminCreatePassword">
                  <span>Password</span>
                  <input
                    id="adminCreatePassword"
                    type="password"
                    minLength={4}
                    placeholder="Minimum 4 characters"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>

                <label className="field" htmlFor="adminCreateRole">
                  <span>System Role</span>
                  <select
                    id="adminCreateRole"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--field)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '8px',
                      color: 'var(--text)',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="user">User (Standard Ledger Access)</option>
                    <option value="admin">Admin (Full Control + Portal Access)</option>
                  </select>
                </label>
              </div>


              <button
                className="button button-primary"
                type="submit"
                disabled={isSubmitting}
                style={{ marginTop: '12px', alignSelf: 'flex-start', padding: '10px 24px' }}
              >
                <Icon name="plus" />
                <span>{isSubmitting ? 'Creating User...' : 'Create Account'}</span>
              </button>
            </form>
          </section>
        ) : null}

        {/* Users management panel */}
        <section className="panel register-panel">
          <div className="panel-heading register-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="eyebrow">Admin portal</span>
              <h2>Users</h2>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="register-count" id="adminPortalCount" style={{ margin: 0 }}>
                {`${users.length} ${users.length === 1 ? 'user' : 'users'}`}
              </div>
              {!showCreateForm && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Icon name="plus" />
                  <span>Add User</span>
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Transactions</th>
                  <th>Income</th>
                  <th>Spending</th>
                  <th className="action-cell">Actions</th>
                </tr>
              </thead>
              <tbody id="adminUserBody">
                {users.map((user) => {
                  const { txCount, totals } = getUserMetrics(user.id);
                  return (
                    <tr key={user.id}>
                      <td data-label="User">
                        <div className="user-cell">
                          <strong>{user.name}</strong>
                          <span>@{user.username}</span>
                        </div>
                      </td>
                      <td data-label="Role">
                        <span className={`role-pill ${user.role === 'admin' ? 'admin' : ''}`}>
                          {user.role}
                        </span>
                      </td>
                      <td data-label="Transactions">{txCount}</td>
                      <td data-label="Income">
                        <div className="merchant-cell">
                          <strong>{formatMoney(totals.income.KWD, 'KWD')}</strong>
                          <span>{formatMoney(totals.income.INR, 'INR')}</span>
                        </div>
                      </td>
                      <td data-label="Spending">
                        <div className="merchant-cell">
                          <strong>{formatMoney(totals.expense.KWD, 'KWD')}</strong>
                          <span>{formatMoney(totals.expense.INR, 'INR')}</span>
                        </div>
                      </td>
                      <td data-label="Actions" className="action-cell">
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            type="button"
                            onClick={() => onOpenUserLedger(user.id)}
                            title="Open ledger"
                            aria-label="Open ledger"
                          >
                            <Icon name="chart" />
                          </button>
                          <button
                            className="icon-button danger"
                            type="button"
                            onClick={() => onResetUserLedger(user.id)}
                            title="Reset ledger"
                            aria-label="Reset ledger"
                          >
                            <Icon name="trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* Customized premium Alert modal popup */}
      {alertModal.show && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(7, 9, 12, 0.45)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          animation: 'fade-in 0.25s ease'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: '24px',
            padding: '36px 32px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Modal Icon Badge */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: alertModal.tone === 'success' 
                ? 'linear-gradient(135deg, #0a4f70, #46a1c5)' // Premium deep teal-blue to cyan
                : alertModal.tone === 'error'
                ? 'linear-gradient(135deg, #d34221, #f2894f)' // Premium terracotta red/coral orange
                : 'linear-gradient(135deg, #118ab2, #84cce4)', // Cyan to light blue gradient
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 'bold',
              marginBottom: '20px',
              boxShadow: alertModal.tone === 'success'
                ? '0 8px 20px rgba(10, 79, 112, 0.3)'
                : alertModal.tone === 'error'
                ? '0 8px 20px rgba(211, 66, 33, 0.3)'
                : '0 8px 20px rgba(17, 138, 178, 0.3)'
            }}>
              {alertModal.tone === 'success' ? '✓' : alertModal.tone === 'error' ? '!' : 'i'}
            </div>
            
            <h3 style={{
              fontSize: '20px',
              fontWeight: 800,
              margin: '0 0 10px 0',
              color: 'var(--text)',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {alertModal.title}
            </h3>
            
            <p style={{
              fontSize: '13.5px',
              color: 'var(--muted)',
              margin: '0 0 28px 0',
              lineHeight: 1.5
            }}>
              {alertModal.text}
            </p>
            
            <button
              className="button"
              type="button"
              onClick={() => setAlertModal(prev => ({ ...prev, show: false }))}
              style={{
                width: '100%',
                padding: '12px 0',
                background: alertModal.tone === 'success'
                  ? 'linear-gradient(135deg, #0a4f70, #46a1c5)'
                  : alertModal.tone === 'error'
                  ? 'linear-gradient(135deg, #d34221, #f2894f)'
                  : 'linear-gradient(135deg, #118ab2, #84cce4)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: alertModal.tone === 'success'
                  ? '0 4px 14px rgba(10, 79, 112, 0.3)'
                  : alertModal.tone === 'error'
                  ? '0 4px 14px rgba(211, 66, 33, 0.3)'
                  : '0 4px 14px rgba(17, 138, 178, 0.3)',
                transition: 'transform 0.15s ease, filter 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </>
  );
};
export default AdminView;
