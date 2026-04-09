import React, { useState } from 'react';
import { DonutChart } from '../components/DonutChart';
import { AccountPanel } from '../components/AccountPanel';
import { useEmails } from '../hooks/useEmails';

const PROVIDER_COLORS = {
  gmail: '#EA4335',
  outlook: '#0078D4',
  yahoo: '#6001D2',
  others: '#888780',
};

export default function Dashboard() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { accounts, stats, loading, error, lastUpdated, triggerPoll } = useEmails(filter, search);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const totalEmails = stats?.total || 0;
  const gmailPct = totalEmails > 0 ? Math.round((stats?.byAccount?.filter(a => a.email.includes('gmail')).reduce((s, a) => s + a.inbox + a.spam, 0) / totalEmails) * 100) : 0;
  const outlookPct = totalEmails > 0 ? Math.round((stats?.byAccount?.filter(a => a.email.includes('outlook') || a.email.includes('hotmail')).reduce((s, a) => s + a.inbox + a.spam, 0) / totalEmails) * 100) : 0;
  const yahooPct = totalEmails > 0 ? Math.round((stats?.byAccount?.filter(a => a.email.includes('yahoo') || a.email.includes('att')).reduce((s, a) => s + a.inbox + a.spam, 0) / totalEmails) * 100) : 0;
  const othersPct = Math.max(0, 100 - gmailPct - outlookPct - yahooPct);

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Top Nav */}
      <div style={{
        background: '#1e293b', borderBottom: '0.5px solid #334155',
        padding: '0 20px', height: 52,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, background: '#3b82f6', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff',
          }}>✉</div>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Inboxious</span>
        </div>

        <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: 480, display: 'flex', gap: 8 }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search subject, sender..."
            style={{
              flex: 1, padding: '7px 14px', borderRadius: 8,
              border: '0.5px solid #475569', background: '#0f172a',
              color: '#f1f5f9', fontSize: 13, outline: 'none',
            }}
          />
          <button type="submit" style={{
            padding: '7px 16px', background: '#3b82f6', border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer',
          }}>Search</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={triggerPoll}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '0.5px solid #475569', borderRadius: 8,
              color: '#94a3b8', fontSize: 12, cursor: 'pointer',
            }}
          >
            ↻ Poll now
          </button>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: '#475569' }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '20px' }}>

        {/* Provider stats + instructions */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 10, flex: 1,
          }}>
            {[
              { label: 'Gmail', pct: gmailPct, color: PROVIDER_COLORS.gmail },
              { label: 'Outlook / Hotmail', pct: outlookPct, color: PROVIDER_COLORS.outlook },
              { label: 'At&t / Yahoo', pct: yahooPct, color: PROVIDER_COLORS.yahoo },
              { label: 'Others', pct: othersPct, color: PROVIDER_COLORS.others },
            ].map((p) => (
              <div key={p.label} style={{
                background: '#1e293b', borderRadius: 12,
                border: '0.5px solid #334155',
              }}>
                <DonutChart percent={p.pct} color={p.color} label={p.label} />
              </div>
            ))}
          </div>

          <div style={{
            background: '#1e293b', borderRadius: 12, border: '0.5px solid #334155',
            padding: '16px 20px', minWidth: 280,
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9', marginBottom: 10 }}>
              How to test your emails?
            </div>
            {[
              'Copy recipients by clicking Copy recipients',
              'Send your test mail to the copied email addresses.',
              "Search for the 'Subject line' or 'Sender's name' to see the stats.",
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#3b82f6',
                  background: '#1e3a5f', borderRadius: '50%',
                  width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, marginTop: 1,
                }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary + filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {[
              { label: 'Total', val: stats?.total || 0, color: '#f1f5f9' },
              { label: 'Inbox', val: stats?.inboxCount || 0, color: '#60a5fa' },
              { label: 'Spam', val: stats?.spamCount || 0, color: '#f87171' },
            ].map((s) => (
              <span key={s.label} style={{ fontSize: 13, color: '#64748b' }}>
                {s.label}: <span style={{ fontWeight: 500, color: s.color }}>{s.val}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'inbox', 'spam'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                  border: filter === f ? 'none' : '0.5px solid #334155',
                  background: filter === f ? '#1a7f37' : 'transparent',
                  color: filter === f ? '#fff' : '#94a3b8',
                  transition: 'all 0.15s',
                }}
              >
                {f === 'all' ? 'All' : f === 'inbox' ? 'Inbox only' : 'Spam only'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#7f1d1d', color: '#fca5a5', padding: '10px 16px',
            borderRadius: 8, fontSize: 13, marginBottom: 14,
          }}>
            Error: {error}. Make sure the backend is running.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
            Loading emails...
          </div>
        )}

        {/* Account panels grid */}
        {!loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))',
            gap: 14,
          }}>
            {accounts.map((item) => (
              <AccountPanel
                key={item.account.id}
                account={item.account}
                emails={item.emails}
              />
            ))}
            {accounts.length === 0 && !error && (
              <div style={{ color: '#475569', fontSize: 13, gridColumn: '1/-1', textAlign: 'center', padding: '40px 0' }}>
                No accounts configured. Add ACCOUNT_1_EMAIL etc. to your .env file.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
