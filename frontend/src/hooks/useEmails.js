import { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '';

export function useEmails(filter, search) {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);

      const [emailsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/emails?${params}`),
        fetch(`${API}/api/stats`),
      ]);

      if (!emailsRes.ok || !statsRes.ok) throw new Error('API error');

      const [emailsData, statsData] = await Promise.all([
        emailsRes.json(),
        statsRes.json(),
      ]);

      setAccounts(emailsData);
      setStats(statsData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const triggerPoll = async () => {
    await fetch(`${API}/api/poll`, { method: 'POST' });
    setTimeout(fetchData, 2000);
  };

  return { accounts, stats, loading, error, lastUpdated, triggerPoll, refresh: fetchData };
}
