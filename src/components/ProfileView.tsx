import React, { useState } from 'react';
import type { User } from '../types';
import { hashPassword } from '../utils';

interface ProfileViewProps {
  currentUser: User;
  onUpdateProfile: (
    name: string,
    newPasswordHash?: string,
    securityQuestion?: string,
    securityAnswerHash?: string
  ) => Promise<void>;
  onCancel: () => void;
}

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "In what city were you born?",
  "What was the name of your first school?",
  "What is your favorite book or movie?"
];

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onUpdateProfile, onCancel }) => {
  const [name, setName] = useState(currentUser.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Security recovery question states
  const [securityQuestion, setSecurityQuestion] = useState(currentUser.securityQuestion || SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Reusable custom premium alert modal popup state
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
        text: 'Please enter your current password to verify and save changes.',
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

      await onUpdateProfile(
        name.trim(),
        newPasswordHash,
        securityQuestion,
        newAnswerHash
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityAnswer('');

      if (newPassword) {
        setAlertModal({
          show: true,
          title: 'Password Updated!',
          text: 'Your security password has been changed successfully.',
          tone: 'success'
        });
      } else {
        setAlertModal({
          show: true,
          title: 'Profile Saved',
          text: 'Your profile settings have been updated successfully.',
          tone: 'success'
        });
      }
    } catch (err) {
      setAlertModal({
        show: true,
        title: 'Error Saving Settings',
        text: 'Failed to update profile. Please check your network and try again.',
        tone: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Get user initials for premium avatar
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <section className="panel" aria-label="User profile settings" style={{ maxWidth: '580px', margin: '40px auto' }}>
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
            <h2>Account Profile</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
          <label className="field" htmlFor="profileNameInput">
            <span>Full Name</span>
            <input
              id="profileNameInput"
              type="text"
              required
              maxLength={64}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field" htmlFor="profileCurrentPassword">
            <span>Current Password (Required to Save Changes)</span>
            <input
              id="profileCurrentPassword"
              type="password"
              required
              placeholder="Verify current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '10px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Change Password</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Leave blank if you do not want to update password.</p>
          </div>

          <div className="field-row">
            <label className="field" htmlFor="profileNewPassword">
              <span>New Password</span>
              <input
                id="profileNewPassword"
                type="password"
                placeholder="Enter new password"
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

          <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)', margin: '10px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Password Recovery Settings</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Configure security question for self-service password resets.</p>
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

          <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button className="button button-primary" type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Saving...' : 'Save Changes'}
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
                  onCancel(); // Navigate back to Dashboard
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
