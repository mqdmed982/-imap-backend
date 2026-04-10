import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Small artificial delay so it feels like a real check
    await new Promise((r) => setTimeout(r, 500));

    const correctPassword = process.env.REACT_APP_DASHBOARD_PASSWORD;

    if (password === correctPassword) {
      sessionStorage.setItem('inboxious_auth', '1');
      onLogin();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'Inter, system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#1e293b',
        border: '0.5px solid #334155',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, background: '#3b82f6', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff',
          }}>✉</div>
          <span style={{ fontSize: 20, fontWeight: 600, color: '#f1f5f9' }}>Inboxious</span>
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9', margin: 0, marginBottom: 6 }}>
            Welcome back
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Enter your password to access the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Password field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                required
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  borderRadius: 8,
                  border: error ? '1px solid #ef4444' : '0.5px solid #475569',
                  background: '#0f172a',
                  color: '#f1f5f9',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => {
                  if (!error) e.target.style.borderColor = '#3b82f6';
                }}
                onBlur={e => {
                  if (!error) e.target.style.borderColor = '#475569';
                }}
              />
              {/* Show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#475569', fontSize: 16, padding: 0, lineHeight: 1,
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '0.5px solid #ef4444',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              color: '#f87171',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>⚠</span>
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              padding: '11px',
              background: loading || !password ? '#1e3a5f' : '#3b82f6',
              border: 'none',
              borderRadius: 8,
              color: loading || !password ? '#60a5fa' : '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: 4,
            }}
          >
            {loading ? 'Checking...' : 'Sign in →'}
          </button>
        </form>

        {/* Hint */}
        <p style={{ marginTop: 20, fontSize: 11, color: '#334155', textAlign: 'center', margin: '20px 0 0' }}>
          Set <code style={{ color: '#475569', background: '#0f172a', padding: '1px 5px', borderRadius: 4 }}>REACT_APP_DASHBOARD_PASSWORD</code> in your Render env vars
        </p>
      </div>
    </div>
  );
}
