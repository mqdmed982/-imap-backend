import React, { useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || '';

function timeStr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function EmailViewer({ emailId, onClose, onDeleted }) {
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('html');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!emailId) return;
    setLoading(true);
    setError(null);
    setConfirmDelete(false);
    fetch(`${API}/api/emails/${emailId}`)
      .then(r => r.json())
      .then(data => { setEmail(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [emailId]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/emails/${emailId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted && onDeleted(emailId);
      onClose();
    } catch (err) {
      setError('Delete failed: ' + err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const tabs = [
    { id: 'html', label: 'HTML Preview' },
    { id: 'source', label: 'Raw Source' },
    { id: 'text', label: 'Plain Text' },
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#1e293b', borderRadius: 14,
        border: '0.5px solid #334155',
        width: '100%', maxWidth: 900,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '0.5px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ fontSize: 13, color: '#64748b' }}>Loading...</div>
            ) : error ? (
              <div style={{ fontSize: 13, color: '#f87171' }}>{error}</div>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 6, lineHeight: 1.4 }}>
                  {email.subject}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>From: </span>
                    {email.senderName || email.senderAddress}
                    {email.senderName && (
                      <span style={{ color: '#475569' }}> &lt;{email.senderAddress}&gt;</span>
                    )}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>Date: </span>{timeStr(email.date)}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    <span style={{ color: '#64748b' }}>Account: </span>{email.accountEmail}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                    background: email?.isSpam ? '#7f1d1d' : '#14532d',
                    color: email?.isSpam ? '#fca5a5' : '#86efac',
                  }}>
                    {email?.isSpam ? 'SPAM' : 'INBOX'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            {!loading && !error && (
              confirmDelete ? (
                <>
                  <span style={{ fontSize: 12, color: '#fca5a5' }}>Confirm delete?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                      background: '#7f1d1d', border: '0.5px solid #ef4444',
                      color: '#fca5a5', fontWeight: 500,
                    }}
                  >
                    {deleting ? 'Deleting...' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                      background: 'transparent', border: '0.5px solid #334155', color: '#94a3b8',
                    }}
                  >Cancel</button>
                </>
              ) : (
                <button
                  onClick={handleDelete}
                  style={{
                    padding: '5px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                    background: 'transparent', border: '0.5px solid #ef4444',
                    color: '#f87171', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/>
                  </svg>
                  Delete
                </button>
              )
            )}
            <button
              onClick={onClose}
              style={{
                background: '#334155', border: 'none', borderRadius: 8,
                color: '#94a3b8', fontSize: 18, width: 32, height: 32,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >×</button>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !error && (
          <div style={{
            display: 'flex', gap: 4, padding: '10px 20px 0',
            borderBottom: '0.5px solid #334155', flexShrink: 0,
          }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '7px 16px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  border: 'none', borderRadius: '6px 6px 0 0',
                  background: tab === t.id ? '#0f172a' : 'transparent',
                  color: tab === t.id ? '#60a5fa' : '#64748b',
                  borderBottom: tab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
                  transition: 'all 0.15s',
                }}
              >{t.label}</button>
            ))}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', background: '#0f172a' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              Loading email...
            </div>
          )}

          {!loading && !error && tab === 'html' && (
            email.htmlBody ? (
              <iframe
                srcDoc={email.htmlBody}
                title="Email HTML"
                sandbox="allow-same-origin"
                style={{ width: '100%', height: '100%', minHeight: 440, border: 'none', background: '#fff' }}
              />
            ) : (
              <pre style={{ padding: 24, fontSize: 13, color: '#cbd5e1', fontFamily: 'monospace', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, minHeight: 440 }}>
                {email.textBody || 'No HTML content available.'}
              </pre>
            )
          )}

          {!loading && !error && tab === 'source' && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => navigator.clipboard.writeText(email.rawSource || '')}
                style={{
                  position: 'absolute', top: 12, right: 16, zIndex: 10,
                  padding: '4px 12px', fontSize: 11, borderRadius: 6,
                  background: '#1e293b', border: '0.5px solid #334155',
                  color: '#94a3b8', cursor: 'pointer',
                }}
              >Copy</button>
              <pre style={{
                padding: '40px 20px 20px', fontSize: 11, color: '#94a3b8',
                fontFamily: 'monospace', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                margin: 0, minHeight: 440,
              }}>
                {email.rawSource || 'Raw source not available. Re-poll to fetch.'}
              </pre>
            </div>
          )}

          {!loading && !error && tab === 'text' && (
            <pre style={{
              padding: 24, fontSize: 13, color: '#cbd5e1',
              fontFamily: 'monospace', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, minHeight: 440,
            }}>
              {email.textBody || 'No plain text content available.'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
