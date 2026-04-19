import { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL || '';
const REFRESH_INTERVAL = 60000; // 60s auto-refresh

export function useEmails(filter, search) {
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);
  const hasDataRef = useRef(false);
  const abortRef = useRef(null);

  const fetchData = useCallback(async (showLoader = false) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (showLoader && !hasDataRef.current) setLoading(true);

      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.set('filter', filter);
      if (search) params.set('search', search);

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
        console.warn('[useEmails] Request cancelled or timed out');
        if (!hasDataRef.current) setError('Request timed out. Retrying...');
      } else {
        if (!hasDataRef.current) setError(err.message);
        else console.warn('[useEmails] Background refresh failed:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  // Reset + re-fetch when filter/search changes
  useEffect(() => {
    hasDataRef.current = false;
    fetchData(true);
  }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    intervalRef.current = setInterval(() => fetchData(false), REFRESH_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  const triggerPoll = async () => {
    setPolling(true);
    try {
      await fetch(`${API}/api/poll`, { method: 'POST' });
      // Wait for backend IMAP fetch to complete (accounts × ~3s each)
      await new Promise(r => setTimeout(r, 8000));
      await fetchData(false);
    } catch (err) {
      if (!hasDataRef.current) setError(err.message);
    } finally {
      setPolling(false);
    }
  };

  return { accounts, stats, loading, polling, error, lastUpdated, triggerPoll, refresh: fetchData };
}
