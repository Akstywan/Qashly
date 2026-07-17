import React, { useState } from 'react';
import type { User } from '../types';
import { hashPassword } from '../utils';
import { dbService } from '../dbService';
import Icon from './Icon';

interface AuthScreenProps {
  users: User[];
  onLogin: (userId: string) => void;
  onCreateUser: (user: User) => void;
  sessionExpired?: boolean;
}

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "In what city were you born?",
  "What was the name of your first school?",
  "What is your favorite book or movie?"
];

export const AuthScreen: React.FC<AuthScreenProps> = ({ users, onLogin, sessionExpired }) => {
  // Modes: 'signin' | 'forgot'
  const [authMode, setAuthMode] = useState<'signin' | 'forgot'>('signin');
  
  // Signin & signup fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Find matched user dynamically based on entered username
  const cleanUsername = username.trim().toLowerCase();
  const matchedUser = users.find((u) => u.username === cleanUsername);

  // Password recovery sub-flow states
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryUser, setRecoveryUser] = useState<User | null>(null);
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Reusable custom premium alert modal popup state
  const [alertModal, setAlertModal] = useState<{
    show: boolean;
    title: string;
    text: string;
    tone: 'success' | 'error' | 'info';
  }>({ show: false, title: '', text: '', tone: 'info' });

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    // Fetch latest users database status
    let latestUsers;
    try {
      latestUsers = await dbService.getUsers();
    } catch (err: any) {
      setAlertModal({
        show: true,
        title: 'Database Connection Error',
        text: `Failed to fetch users from database: ${err.message || err.details || JSON.stringify(err)}. Please check your internet connection and .env configuration.`,
        tone: 'error'
      });
      return;
    }

    if (authMode === 'signin') {
      if (latestUsers.length === 0) {
        setAlertModal({
          show: true,
          title: 'Database Empty',
          text: 'No accounts exist yet. Please restart or check configuration.',
          tone: 'error'
        });
        return;
      }

      if (!cleanUsername || !password) {
        setAlertModal({
          show: true,
          title: 'Validation Error',
          text: 'Please enter your username and password to log in.',
          tone: 'error'
        });
        return;
      }

      const user = latestUsers.find((u) => u.username === cleanUsername);
      if (!user) {
        setAlertModal({
          show: true,
          title: 'Account Not Found',
          text: 'No account was found with that username.',
          tone: 'error'
        });
        return;
      }

      if (user.isFrozen) {
        setAlertModal({
          show: true,
          title: 'Account Frozen',
          text: 'This account has been frozen. Please contact your administrator.',
          tone: 'error'
        });
        return;
      }

      // Check security question configuration
      if (!user.securityQuestion) {
        if (!securityQuestion.trim() || !securityAnswer.trim()) {
          setAlertModal({
            show: true,
            title: 'Security Setup Required',
            text: 'Please configure your security question and answer to continue.',
            tone: 'error'
          });
          return;
        }

        // Verify password first before saving security details
        const passwordHash = await hashPassword(cleanUsername, password);
        if (user.passwordHash !== passwordHash) {
          setAlertModal({
            show: true,
            title: 'Access Denied',
            text: 'The password you entered is incorrect.',
            tone: 'error'
          });
          return;
        }

        // Save security question/answer to DB
        const answerHash = await hashPassword(cleanUsername, securityAnswer.trim().toLowerCase());
        const updatedUser: User = {
          ...user,
          securityQuestion: securityQuestion.trim(),
          securityAnswerHash: answerHash
        };
        await dbService.saveUser(updatedUser);
      } else {
        // Verify password
        const passwordHash = await hashPassword(cleanUsername, password);
        if (user.passwordHash !== passwordHash) {
          setAlertModal({
            show: true,
            title: 'Access Denied',
            text: 'The password you entered is incorrect.',
            tone: 'error'
          });
          return;
        }
      }

      onLogin(user.id);
    }
  };

  // Password Recovery subflow handlers
  const handleVerifyUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanUsername) {
      setAlertModal({
        show: true,
        title: 'Username Required',
        text: 'Please enter your username to proceed.',
        tone: 'error'
      });
      return;
    }

    const latestUsers = await dbService.getUsers();
    const user = latestUsers.find((u) => u.username === cleanUsername);

    if (!user) {
      setAlertModal({
        show: true,
        title: 'Account Not Found',
        text: 'The username entered does not match any registered profile.',
        tone: 'error'
      });
      return;
    }

    if (!user.securityQuestion || !user.securityAnswerHash) {
      setAlertModal({
        show: true,
        title: 'Recovery Unavailable',
        text: 'This account does not have security questions configured. Please contact your administrator to reset it.',
        tone: 'error'
      });
      return;
    }

    setRecoveryUser(user);
    setRecoveryStep(2);
  };

  const handleVerifyAnswer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryUser) return;

    const answerInputClean = recoveryAnswerInput.trim().toLowerCase();
    const computedHash = await hashPassword(recoveryUser.username, answerInputClean);

    if (computedHash !== recoveryUser.securityAnswerHash) {
      setAlertModal({
        show: true,
        title: 'Verification Failed',
        text: 'The recovery answer entered is incorrect. Please try again.',
        tone: 'error'
      });
      return;
    }

    setRecoveryStep(3);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryUser) return;

    if (!newPassword || newPassword.length < 4) {
      setAlertModal({
        show: true,
        title: 'Password Weak',
        text: 'Password must contain at least 4 characters.',
        tone: 'error'
      });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setAlertModal({
        show: true,
        title: 'Password Mismatch',
        text: 'New password confirmation does not match.',
        tone: 'error'
      });
      return;
    }

    try {
      const newHash = await hashPassword(recoveryUser.username, newPassword);
      const updatedUser: User = {
        ...recoveryUser,
        passwordHash: newHash
      };

      await dbService.saveUser(updatedUser);
      setAlertModal({
        show: true,
        title: 'Password Updated!',
        text: 'Your security password has been changed successfully.',
        tone: 'success'
      });
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Server Error',
        text: 'Failed to reset password. Please check your connection.',
        tone: 'error'
      });
    }
  };

  const handleBackToLogin = () => {
    setAuthMode('signin');
    setRecoveryStep(1);
    setRecoveryUser(null);
    setRecoveryAnswerInput('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  return (
    <div className="auth-split-container">
      {/* Left Showcase Pane */}
      <section className="auth-hero-pane">
        <div className="auth-hero-header">
          <div className="auth-hero-logo" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/logo.png" 
              alt="Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span style={{ position: 'relative', zIndex: 1 }}>Q</span>
          </div>
          <h2>Qashly</h2>
        </div>

        <div className="auth-hero-main">
          <h3 className="auth-hero-title">
            Smart Finance. <br />
            <span>Beautifully Simplified.</span>
          </h3>
          <p className="auth-hero-description">
            Take control of your monthly budgets and cashflow ledger with multi-currency tracking, real-time analytics, and visual reports.
          </p>

          <div className="auth-hero-features">
            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
              </div>
              <div className="auth-feature-content">
                <h4>Multi-Currency Tracking</h4>
                <p>Track transactions in KWD and INR with stacked summaries.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                  <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                </svg>
              </div>
              <div className="auth-feature-content">
                <h4>Interactive Canvas Analytics</h4>
                <p>Spot your category spend mix and monthly flows instantly.</p>
              </div>
            </div>

            <div className="auth-feature-item">
              <div className="auth-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div className="auth-feature-content">
                <h4>Budgets and Limits</h4>
                <p>Configure expense warnings to keep budgets inside boundaries.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-hero-footer">
          <p>© 2026 Qashly. All data is securely stored client-side.</p>
        </div>
      </section>

      {/* Right Form Card Pane */}
      <section className="auth-form-pane">
        <div className="auth-card">
          <div className="brand auth-brand">
            <div className="brand-mark" aria-hidden="true" style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src="/logo.png" 
                alt="Logo" 
                style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'absolute', top: 0, left: 0 }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <span style={{ position: 'relative', zIndex: 1 }}>Q</span>
            </div>
            <h1>Qashly</h1>
            <p id="authSubtitle">
              {authMode === 'forgot'
                ? 'Recover your account password'
                : 'Sign in to your monthly workspace'}
            </p>
          </div>

          {null}

          {sessionExpired && authMode !== 'forgot' && (
            <div style={{
              background: 'rgba(196, 73, 45, 0.08)',
              border: '1px solid rgba(196, 73, 45, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              color: 'var(--red)',
              textAlign: 'center',
              fontWeight: 500,
              lineHeight: '1.4'
            }}>
              ⚠️ Your session has expired due to inactivity. Please sign in again.
            </div>
          )}

          {/* Standard Authentication forms */}
          {authMode !== 'forgot' && (
            <form onSubmit={handleAuthSubmit} className="entry-form">
              <label className="field" htmlFor="usernameInput">
                <span>Username</span>
                <input
                  id="usernameInput"
                  type="text"
                  autoComplete="username"
                  placeholder="yourusername"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>

              {matchedUser && !matchedUser.securityQuestion && (
                <>
                  <label className="field" htmlFor="securityQuestionSelect">
                    <span>Choose a Security Question</span>
                    <select
                      id="securityQuestionSelect"
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

                  <label className="field" htmlFor="securityAnswerInput">
                    <span>Set Answer to Security Question</span>
                    <input
                      id="securityAnswerInput"
                      type="text"
                      placeholder="Your answer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      required
                    />
                  </label>
                </>
              )}

              <label className="field" htmlFor="passwordInput">
                <span>Password</span>
                <input
                  id="passwordInput"
                  type="password"
                  autoComplete="current-password"
                  minLength={4}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>

              <button
                className="button button-primary"
                type="submit"
                style={{ marginTop: '8px' }}
              >
                <Icon name="user" />
                <span>Sign in</span>
              </button>

              {authMode === 'signin' && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    className="button button-soft"
                    style={{ fontSize: '13px', border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', padding: 0 }}
                    onClick={() => {
                      setAuthMode('forgot');
                      setRecoveryStep(1);
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Forgot Password Recovery Forms */}
          {authMode === 'forgot' && (
            <div className="recovery-flow">
              {recoveryStep === 1 && (
                <form onSubmit={handleVerifyUsername} className="entry-form">
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                    Enter your username to retrieve your security recovery question.
                  </p>

                  <label className="field" htmlFor="forgotUsernameInput">
                    <span>Username</span>
                    <input
                      id="forgotUsernameInput"
                      type="text"
                      placeholder="yourusername"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button className="button button-soft" type="button" onClick={handleBackToLogin} style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button className="button button-primary" type="submit" style={{ flex: 2 }}>
                      <Icon name="search" />
                      <span>Next</span>
                    </button>
                  </div>
                </form>
              )}

              {recoveryStep === 2 && recoveryUser && (
                <form onSubmit={handleVerifyAnswer} className="entry-form">
                  <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                    Answering the security question set on your profile correctly will allow you to reset your password.
                  </p>

                  <div style={{
                    padding: '12px',
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '14px',
                    fontWeight: 600
                  }}>
                    ❓ {recoveryUser.securityQuestion}
                  </div>

                  <label className="field" htmlFor="forgotAnswerInput">
                    <span>Your Answer</span>
                    <input
                      id="forgotAnswerInput"
                      type="text"
                      placeholder="Enter security answer"
                      value={recoveryAnswerInput}
                      onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                      required
                      autoFocus
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button className="button button-soft" type="button" onClick={handleBackToLogin} style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button className="button button-primary" type="submit" style={{ flex: 2 }}>
                      <Icon name="check" />
                      <span>Verify Answer</span>
                    </button>
                  </div>
                </form>
              )}

              {recoveryStep === 3 && recoveryUser && (
                <form onSubmit={handleResetPassword} className="entry-form">
                  <p style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600, marginBottom: '16px' }}>
                    ✓ Security answer verified. Please choose a new password.
                  </p>

                  <label className="field" htmlFor="newPasswordInput">
                    <span>New Password</span>
                    <input
                      id="newPasswordInput"
                      type="password"
                      minLength={4}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field" htmlFor="confirmNewPasswordInput">
                    <span>Confirm New Password</span>
                    <input
                      id="confirmNewPasswordInput"
                      type="password"
                      minLength={4}
                      placeholder="Repeat new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                  </label>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button className="button button-soft" type="button" onClick={handleBackToLogin} style={{ flex: 1 }}>
                      Cancel
                    </button>
                    <button className="button button-primary" type="submit" style={{ flex: 2 }}>
                      <Icon name="key" />
                      <span>Reset Password</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </div>
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
              onClick={() => {
                setAlertModal(prev => ({ ...prev, show: false }));
                if (alertModal.tone === 'success') {
                  handleBackToLogin(); // Go back to sign-in page on success
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
              onMouseUp={(e) => e.currentTarget.style.transform = 'none'}
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default AuthScreen;
