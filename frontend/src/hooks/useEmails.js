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
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader && !hasDataRef.current) setLoading(true);
      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const [emailsRes, statsRes] = await Promise.all([
        fetch(`${API}/api/emails?${params}`, { signal: controller.signal }),
        fetch(`${API}/api/stats`, { signal: controller.signal }),
      ]);
      clearTimeout(timeout);

      if (!emailsRes.ok || !statsRes.ok) throw new Error('API error');

      const [emailsData, statsData] = await Promise.all([
        emailsRes.json(),
        statsRes.json(),
      ]);

      setAccounts(emailsData);
      setStats(statsData);
      setLastUpdated(new Date());
      setError(null);
      hasDataRef.current = true;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('[useEmails] Request timed out');
        // Don't show error if we already have data
        if (!hasDataRef.current) setError('Request timed out. Retrying...');
      } else {
        // Only show error banner if we have no data yet
        if (!hasDataRef.current) setError(err.message);
        else console.warn('[useEmails] Background refresh failed:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    hasDataRef.current = false;
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), 60000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const triggerPoll = async () => {
    setPolling(true);
    try {
      await fetch(`${API}/api/poll`, { method: 'POST' });
      // Wait for backend to finish fetching
      await new Promise(r => setTimeout(r, 5000));
      await fetchData(false);
    } catch (err) {
      if (!hasDataRef.current) setError(err.message);
    } finally {
      setPolling(false);
    }
  };

  return { accounts, stats, loading, polling, error, lastUpdated, triggerPoll, refresh: fetchData };
}
