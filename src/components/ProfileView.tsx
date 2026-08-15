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
  const [activeTab, setActiveTab] = useState<'account' | 'preferences' | 'security'>('account');

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

  return (
    <>
      <section className="panel" aria-label="User profile and preferences settings" style={{ maxWidth: '780px', width: '100%', margin: '30px auto', padding: '28px' }}>
        <div className="panel-heading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--green), #0284c7)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 800,
              boxShadow: 'var(--clay-shadow-sm)'
            }}>
              {initials}
            </div>
            <div>
              <h2 style={{ fontSize: '20px', margin: 0 }}>{currentUser.name}</h2>
              <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 600 }}>@{currentUser.username} • {currentUser.role.toUpperCase()}</span>
            </div>
          </div>

          <button className="button button-soft" type="button" onClick={onCancel} style={{ padding: '0 16px', height: '36px' }}>
            Back to Dashboard
          </button>
        </div>

        {/* Profile Segmented Navigation Tabs */}
        <div className="segmented" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '24px' }}>
          <button
            type="button"
            className={`segment ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <Icon name="user" />
            <span>Account Details</span>
          </button>

          <button
            type="button"
            className={`segment ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            <Icon name="settings" />
            <span>Preferences</span>
          </button>

          <button
            type="button"
            className={`segment ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Icon name="key" />
            <span>Security & Password</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* TAB 1: Account Info & Details */}
          {activeTab === 'account' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Account Info & Details</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0 }}>View account role and update your display name.</p>
              </div>

              <div className="form-group">
                <label htmlFor="profileNameInput">Full Name</label>
                <input
                  id="profileNameInput"
                  type="text"
                  required
                  maxLength={64}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    disabled
                    value={`@${currentUser.username}`}
                    style={{ opacity: 0.75, cursor: 'not-allowed' }}
                  />
                </div>

                <div className="form-group">
                  <label>User Role</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.role.toUpperCase()}
                    style={{ opacity: 0.75, cursor: 'not-allowed', fontWeight: 700, color: 'var(--green)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tab1Password">Confirm Password to Save</label>
                <input
                  id="tab1Password"
                  type="password"
                  required
                  placeholder="Enter current password to save"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <button className="button button-primary" type="submit" disabled={loading} style={{ height: '42px', marginTop: '8px' }}>
                {loading ? 'Saving Profile...' : 'Save Account Details'}
              </button>
            </div>
          )}

          {/* TAB 2: User Preferences & Defaults */}
          {activeTab === 'preferences' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>User Preferences & Defaults</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0 }}>Configure default categories, payment modes, and display accounts for fast data entry.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label htmlFor="prefExpCat">Default Expense Category</label>
                  <select
                    id="prefExpCat"
                    value={prefExpenseCategory}
                    onChange={(e) => setPrefExpenseCategory(e.target.value)}
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="prefIncCat">Default Income Category</label>
                  <select
                    id="prefIncCat"
                    value={prefIncomeCategory}
                    onChange={(e) => setPrefIncomeCategory(e.target.value)}
                  >
                    {incomeCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label htmlFor="prefKwdMode">Default KWD Payment Mode</label>
                  <select
                    id="prefKwdMode"
                    value={prefKwdPaymentMode}
                    onChange={(e) => setPrefKwdPaymentMode(e.target.value)}
                  >
                    <option value="KNET / Debit Card">KNET / Debit Card</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="prefInrMode">Default INR Payment Mode</label>
                  <select
                    id="prefInrMode"
                    value={prefInrPaymentMode}
                    onChange={(e) => setPrefInrPaymentMode(e.target.value)}
                  >
                    <option value="UPI (GPay / PhonePe / Paytm)">UPI (GPay / PhonePe / Paytm)</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="prefAcc">Default Display Account</label>
                <select
                  id="prefAcc"
                  value={prefDisplayAccount}
                  onChange={(e) => setPrefDisplayAccount(e.target.value)}
                >
                  <option value="all">All Accounts (Show Everything)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.name}>{acc.name} ({acc.currency || 'KWD'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="tab2Password">Confirm Password to Save</label>
                <input
                  id="tab2Password"
                  type="password"
                  required
                  placeholder="Enter current password to save"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <button className="button button-primary" type="submit" disabled={loading} style={{ height: '42px', marginTop: '8px' }}>
                {loading ? 'Saving Preferences...' : 'Save Preferences'}
              </button>
            </div>
          )}

          {/* TAB 3: Security & Password Management */}
          {activeTab === 'security' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Security & Password Management</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0 }}>Update your login password and security recovery question.</p>
              </div>

              <div className="form-group">
                <label htmlFor="profileCurrentPassword">Current Password (Required) *</label>
                <input
                  id="profileCurrentPassword"
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label htmlFor="profileNewPassword">New Password</label>
                  <input
                    id="profileNewPassword"
                    type="password"
                    placeholder="Leave blank to keep unchanged"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="profileConfirmPassword">Confirm New Password</label>
                  <input
                    id="profileConfirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="profileSecurityQSelect">Security Recovery Question</label>
                <select
                  id="profileSecurityQSelect"
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                >
                  {SECURITY_QUESTIONS.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="profileSecurityAnswer">Security Answer</label>
                <input
                  id="profileSecurityAnswer"
                  type="text"
                  placeholder={currentUser.securityAnswerHash ? "•••••••• (Leave blank to keep current answer)" : "Enter recovery answer"}
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                />
              </div>

              {onResetStats && (
                <div style={{
                  background: 'var(--red-soft)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius)',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  marginTop: '8px'
                }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: 'var(--red-text)' }}>Reset Ledger Stats & Data</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      Permanently clear all logged transactions, budgets, and savings pots.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button button-soft danger"
                    onClick={onResetStats}
                    style={{ height: '36px', fontSize: '12.5px' }}
                  >
                    <Icon name="trash" />
                    <span>Reset Data</span>
                  </button>
                </div>
              )}

              <button className="button button-primary" type="submit" disabled={loading} style={{ height: '42px', marginTop: '8px' }}>
                {loading ? 'Updating Security Settings...' : 'Save Security Settings'}
              </button>
            </div>
          )}
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
