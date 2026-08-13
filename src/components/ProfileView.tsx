import React, { useState } from 'react';
import type { User, Account, UserPreferences } from '../types';
import { hashPassword, expenseCategories, incomeCategories } from '../utils';
import Icon from './Icon';

interface ProfileViewProps {
  currentUser: User;
  accounts?: Account[];
  onUpdateProfile: (
    name: string,
    newPasswordHash?: string,
    securityQuestion?: string,
    securityAnswerHash?: string
  ) => Promise<void>;
  onSavePreferences?: (updatedPrefs: UserPreferences) => Promise<void>;
  onResetStats?: () => void;
  onCancel: () => void;
}

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "In what city were you born?",
  "What was the name of your first school?",
  "What is your favorite book or movie?"
];

export const ProfileView: React.FC<ProfileViewProps> = ({ 
  currentUser, 
  accounts = [], 
  onUpdateProfile, 
  onSavePreferences,
  onResetStats,
  onCancel 
}) => {
  const [name, setName] = useState(currentUser.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Security recovery question states
  const [securityQuestion, setSecurityQuestion] = useState(currentUser.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // User preferences state
  const initialPrefs = currentUser.userPreferences || {};
  const [prefExpenseCategory, setPrefExpenseCategory] = useState(initialPrefs.defaultExpenseCategory || expenseCategories[0]);
  const [prefIncomeCategory, setPrefIncomeCategory] = useState(initialPrefs.defaultIncomeCategory || incomeCategories[0]);
  const [prefKwdPaymentMode, setPrefKwdPaymentMode] = useState(initialPrefs.defaultKwdPaymentMode || 'KNET / Debit Card');
  const [prefInrPaymentMode, setPrefInrPaymentMode] = useState(initialPrefs.defaultInrPaymentMode || 'UPI');
  const [prefDisplayAccount, setPrefDisplayAccount] = useState(initialPrefs.defaultDisplayAccount || 'all');

  // Reusable custom alert modal state
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    text: string;
    tone: 'success' | 'error' | 'info';
  }>({ show: false, title: '', text: '', tone: 'info' });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setAlertModal({
        show: true,
        title: 'Validation Error',
        text: 'Full name cannot be empty.',
        tone: 'error'
      });
      return;
    }

    if (!currentPassword) {
      setAlertModal({
        show: true,
        title: 'Verification Required',
        text: 'Please enter your current password to verify and save profile changes.',
        tone: 'error'
      });
      return;
    }

    setLoading(true);

    try {
      // Verify current password
      const verifyHash = await hashPassword(currentUser.username, currentPassword);
      if (verifyHash !== currentUser.passwordHash) {
        setAlertModal({
          show: true,
          title: 'Access Denied',
          text: 'The current password you entered is incorrect.',
          tone: 'error'
        });
        setLoading(false);
        return;
      }

      let newPasswordHash: string | undefined = undefined;
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          setAlertModal({
            show: true,
            title: 'Password Mismatch',
            text: 'Your new password and confirmation password do not match.',
            tone: 'error'
          });
          setLoading(false);
          return;
        }
        newPasswordHash = await hashPassword(currentUser.username, newPassword);
      }

      let newAnswerHash: string | undefined = undefined;
      if (securityAnswer.trim()) {
        newAnswerHash = await hashPassword(currentUser.username, securityAnswer.trim().toLowerCase());
      }

      // 1. Update profile details
      await onUpdateProfile(
        name.trim(),
        newPasswordHash,
        securityQuestion,
        newAnswerHash
      );

      // 2. Save user preferences
      if (onSavePreferences) {
        await onSavePreferences({
          defaultExpenseCategory: prefExpenseCategory,
          defaultIncomeCategory: prefIncomeCategory,
          defaultKwdPaymentMode: prefKwdPaymentMode,
          defaultInrPaymentMode: prefInrPaymentMode,
          defaultDisplayAccount: prefDisplayAccount,
        });
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');

      setAlertModal({
        show: true,
        title: 'Profile & Preferences Saved',
        text: 'Your account profile and cloud user preferences have been updated successfully.',
        tone: 'success'
      });
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Error Saving Settings',
        text: 'Failed to update profile settings. Please try again.',
        tone: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const kwdAccounts = accounts.filter(a => !a.currency || a.currency === 'KWD');
  const inrAccounts = accounts.filter(a => a.currency === 'INR');

  return (
    <>
      <section className="panel" aria-label="User profile and preferences settings" style={{ maxWidth: '820px', width: '100%', margin: '30px auto' }}>
        <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--teal), var(--indigo))',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            fontWeight: 800,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}>
            {initials}
          </div>
          <div>
            <span className="eyebrow" id="profileUsername">@{currentUser.username}</span>
            <h2>Account Profile & Preferences</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
          
          {/* User Account Menu & Details Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Account Info & Details</h3>
            <div className="table-wrap" style={{ borderRadius: '12px', border: '1px solid var(--border-glass)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '70%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Item / Attribute</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Username</td>
                    <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>@{currentUser.username}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Role</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: currentUser.role === 'admin' ? 'rgba(70, 161, 197, 0.15)' : 'var(--field)',
                        color: currentUser.role === 'admin' ? 'var(--teal)' : 'var(--muted)'
                      }}>
                        {currentUser.role}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Full Name</td>
                    <td style={{ padding: '10px 14px' }}>
                      <input
                        id="profileNameInput"
                        type="text"
                        required
                        maxLength={64}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '4px 0' }} />

          {/* User Preferences Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>User Preferences & Defaults</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Configure default categories, payment modes, and account filter for quick data entry.</p>
            </div>

            <div className="table-wrap" style={{ borderRadius: '12px', border: '1px solid var(--border-glass)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '34%' }} />
                  <col style={{ width: '38%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border-glass)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Setting</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Default Selection</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Default Expense Category</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>Pre-selected when adding expense entries</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={prefExpenseCategory}
                        onChange={(e) => setPrefExpenseCategory(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      >
                        {expenseCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Default Income Category</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>Pre-selected when adding income entries</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={prefIncomeCategory}
                        onChange={(e) => setPrefIncomeCategory(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      >
                        {incomeCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Default KWD Payment Mode</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>Default payment mode for KWD transactions</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={prefKwdPaymentMode}
                        onChange={(e) => setPrefKwdPaymentMode(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      >
                        <option value="KNET / Debit Card">KNET / Debit Card</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        {kwdAccounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.name} (KWD)</option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Default INR Payment Mode</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>Default payment mode for INR transactions</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={prefInrPaymentMode}
                        onChange={(e) => setPrefInrPaymentMode(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      >
                        <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Debit Card">Debit Card</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Cash">Cash</option>
                        {inrAccounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.name} (INR)</option>
                        ))}
                      </select>
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Default Display Account</td>
                    <td style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: '12px' }}>Initial account filter selected on launch</td>
                    <td style={{ padding: '12px 14px' }}>
                      <select
                        value={prefDisplayAccount}
                        onChange={(e) => setPrefDisplayAccount(e.target.value)}
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          boxSizing: 'border-box',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          background: 'var(--field)',
                          color: 'var(--text)',
                          fontSize: '13px'
                        }}
                      >
                        <option value="all">All Accounts (Show Everything)</option>
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.name} ({acc.currency || 'KWD'})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '4px 0' }} />

          {/* Password Security & Questions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Security & Password Management</h3>
              <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Update password or recovery question. Current password is required to verify changes.</p>
            </div>

            <label className="field" htmlFor="profileCurrentPassword">
              <span>Current Password (Required to Save Changes) *</span>
              <input
                id="profileCurrentPassword"
                type="password"
                required
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>

            <div className="field-row">
              <label className="field" htmlFor="profileNewPassword">
                <span>New Password</span>
                <input
                  id="profileNewPassword"
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>

              <label className="field" htmlFor="profileConfirmPassword">
                <span>Confirm New Password</span>
                <input
                  id="profileConfirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>

            <label className="field" htmlFor="profileSecurityQSelect">
              <span>Security Recovery Question</span>
              <select
                id="profileSecurityQSelect"
                value={securityQuestion}
                onChange={(e) => setSecurityQuestion(e.target.value)}
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
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </label>

            <label className="field" htmlFor="profileSecurityAnswer">
              <span>Security Answer</span>
              <input
                id="profileSecurityAnswer"
                type="text"
                placeholder={currentUser.securityAnswerHash ? "•••••••• (Leave blank to keep current answer)" : "Enter recovery answer"}
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
              />
            </label>
          </div>

          {onResetStats && (
            <>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '4px 0' }} />

              <div style={{
                background: 'rgba(211, 66, 33, 0.08)',
                border: '1px solid rgba(211, 66, 33, 0.25)',
                borderRadius: '14px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginTop: '4px'
              }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--red, #e55353)' }}>Reset Ledger Stats & Data</h4>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                    Permanently clear all logged transactions, budgets, and savings pots for your workspace.
                  </p>
                </div>
                <button
                  type="button"
                  className="button button-danger"
                  id="resetStatsBtn"
                  onClick={onResetStats}
                  style={{
                    background: '#d34221',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Icon name="trash" />
                  <span>Reset Stats</span>
                </button>
              </div>
            </>
          )}

          <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button className="button button-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Saving Settings...' : 'Save Profile & Preferences'}
            </button>
            <button className="button button-soft" type="button" onClick={onCancel} style={{ width: '100px' }}>
              Back
            </button>
          </div>
        </form>
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
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: alertModal.tone === 'success' 
                ? 'linear-gradient(135deg, #0a4f70, #46a1c5)' 
                : alertModal.tone === 'error'
                ? 'linear-gradient(135deg, #d34221, #f2894f)' 
                : 'linear-gradient(135deg, #118ab2, #84cce4)', 
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
              onClick={() => {
                setAlertModal(prev => ({ ...prev, show: false }));
                if (alertModal.tone === 'success') {
                  onCancel();
                }
              }}
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
              onMouseUp={(e) => e.currentTarget.style.transform = 'none' }
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileView;
