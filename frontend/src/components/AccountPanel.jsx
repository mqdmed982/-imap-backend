import React from 'react';
import { Badge } from './Badge';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function maskAddress(addr) {
  if (!addr) return '';
  const [local, domain] = addr.split('@');
  if (!domain) return addr;
  const masked = local.length > 4 ? local.slice(0, 4) + '****' : '****';
  const domainParts = domain.split('.');
  return `${masked}@****.${domainParts[domainParts.length - 1]}`;
}

export function AccountPanel({ account, emails, onEmailClick }) {
  return (
    <div style={{
      background: '#fff',
      border: '0.5px solid #e5e7eb',
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: '#1a7f37',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, background: '#fff', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#EA4335',
          }}>M</div>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>Gmail</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{account.name}</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{account.email}</div>
        </div>
      </div>

      {/* Email rows */}
      <div style={{ overflowY: 'auto', maxHeight: 260 }}>
        {emails.length === 0 ? (
          <div style={{ padding: '14px', fontSize: 12, color: '#9ca3af' }}>No emails found.</div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              onClick={() => onEmailClick && onEmailClick(email.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderBottom: '0.5px solid #f3f4f6',
                gap: 8,
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#f0f9ff';
                e.currentTarget.style.borderLeft = '3px solid #3b82f6';
                e.currentTarget.style.paddingLeft = '11px';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderLeft = 'none';
                e.currentTarget.style.paddingLeft = '14px';
              }}
            >
              {/* Sender */}
              <div style={{ width: 130, flexShrink: 0, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: '#111827',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {email.senderName || email.senderAddress}
                </div>
                <div style={{
                  fontSize: 10, color: '#9ca3af',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {maskAddress(email.senderAddress)}
                </div>
              </div>

              {/* Subject */}
              <div style={{
                flex: 1, fontSize: 12, color: '#374151', minWidth: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {email.subject}
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 3, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 }}>
                {(email.labels || []).map((label) => (
                  <Badge key={label} type={label} />
                ))}
              </div>

              {/* Time */}
              <div style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, minWidth: 44, textAlign: 'right' }}>
                {timeAgo(email.date || email.fetchedAt)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
