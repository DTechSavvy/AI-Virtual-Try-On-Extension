import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '../api/api-client.js';
import { UserSummary } from '@vton/shared';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserSummary) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasMinLen = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    if (isRegister && !isPasswordValid) {
      setError('Password must be at least 8 characters and contain uppercase, lowercase, and a number.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const cleanName = displayName.trim() || undefined;
        const res = await apiClient.register(cleanEmail, password, cleanName);
        onSuccess(res.user);
      } else {
        const res = await apiClient.login(cleanEmail, password);
        onSuccess(res.user);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '340px',
          padding: '20px',
          position: 'relative',
          background: '#0f172a',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '18px',
            cursor: 'pointer',
          }}
          aria-label="Close dialog"
        >
          ✕
        </button>

        <h2 id="auth-modal-title" style={{ fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>
          {isRegister ? 'Create VTON Account' : 'Sign In to Virtual Try-On'}
        </h2>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>
          {isRegister
            ? 'Sign up to upload your digital profile and try on clothing.'
            : 'Access your saved digital body profile and wardrobe.'}
        </p>

        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '8px 10px',
              borderRadius: '6px',
              color: '#fca5a5',
              fontSize: '11px',
              marginBottom: '12px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isRegister && (
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid var(--card-border)',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                background: '#1e293b',
                border: '1px solid var(--card-border)',
                color: '#fff',
                padding: '8px 10px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Password
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'e.g. Password123!' : '••••••••'}
                style={{
                  width: '100%',
                  background: '#1e293b',
                  border: '1px solid var(--card-border)',
                  color: '#fff',
                  padding: '8px 36px 8px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  color: showPassword ? '#818cf8' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {isRegister && (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  marginTop: '8px',
                  fontSize: '10px',
                }}
              >
                <div style={{ color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 600 }}>
                  Password Requirements:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <span
                    style={{
                      color: hasMinLen ? '#4ade80' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {hasMinLen ? '✓' : '•'} 8+ characters
                  </span>
                  <span
                    style={{
                      color: hasUpper ? '#4ade80' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {hasUpper ? '✓' : '•'} Uppercase (A-Z)
                  </span>
                  <span
                    style={{
                      color: hasLower ? '#4ade80' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {hasLower ? '✓' : '•'} Lowercase (a-z)
                  </span>
                  <span
                    style={{
                      color: hasNumber ? '#4ade80' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {hasNumber ? '✓' : '•'} Number (0-9)
                  </span>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '6px', width: '100%' }}>
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '14px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account yet? "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#818cf8',
              fontWeight: '600',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {isRegister ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </div>
    </div>
  );
};
