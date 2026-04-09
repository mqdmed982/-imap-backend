import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || '';

export function useEmails(filter, search) {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
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
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const triggerPoll = async () => {
    setPolling(true);
    try {
      await fetch(`${API}/api/poll`, { method: 'POST' });
      await new Promise(r => setTimeout(r, 3000));
      await fetchData(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPolling(false);
    }
  };

  return { accounts, stats, loading, polling, error, lastUpdated, triggerPoll, refresh: fetchData };
}
