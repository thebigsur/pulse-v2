// ═══════════════════════════════════════════════════════
// THE PULSE v2 — Data Fetching Hooks
// Replace mock data with these hooks when backend is connected
// ═══════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Drafts ───
export function useDrafts() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/drafts?status=generated');
      setDrafts(data);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const approve = async (id) => {
    await apiFetch('/drafts', { method: 'PATCH', body: JSON.stringify({ id, action: 'approve' }) });
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, draft_status: 'approved' } : d));
  };

  const skip = async (id) => {
    await apiFetch('/drafts', { method: 'PATCH', body: JSON.stringify({ id, action: 'skip' }) });
    setDrafts(prev => prev.filter(d => d.id !== id));
  };

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  return { drafts, loading, approve, skip, refetch: fetchDrafts };
}

// ─── Comments ───
export function useComments() {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/comments');
      setComments(data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const markDone = async (id) => {
    await apiFetch('/comments', { method: 'PATCH', body: JSON.stringify({ id }) });
    setComments(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => { fetchComments(); }, [fetchComments]);

  return { comments, loading, markDone, refetch: fetchComments };
}

// ─── Outreach ───
export function useOutreach() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/outreach');
      setLeads(data);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = async (id, status) => {
    await apiFetch('/outreach', { method: 'PATCH', body: JSON.stringify({ id, status }) });
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  return { leads, loading, updateStatus, refetch: fetchLeads };
}

// ─── Profile ───
export function useProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/profile');
      setProfile(data);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = async (updates) => {
    await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(updates) });
    setProfile(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, loading, saveProfile, refetch: fetchProfile };
}

// ─── Performance ───
export function usePerformance() {
  const [data, setData] = useState({ posts: [], metrics: [], commentCount: 0 });
  const [loading, setLoading] = useState(true);

  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFetch('/performance');
      setData(result);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const logPerformance = async (post_id, likes, comments) => {
    await apiFetch('/performance', {
      method: 'POST',
      body: JSON.stringify({ post_id, likes, comments }),
    });
    fetchPerformance();
  };

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  return { data, loading, logPerformance, refetch: fetchPerformance };
}

// ─── Pipeline (run scrape manually) ───
export function usePipeline() {
  const [running, setRunning] = useState({ content: false, comments: false });

  const runPipeline = async (type) => {
    setRunning(prev => ({ ...prev, [type]: true }));
    try {
      await fetch(`/api/scrape/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.__CRON_SECRET || ''}`,
        },
      });
    } catch (err) {
      console.error(`Pipeline ${type} failed:`, err);
    } finally {
      setRunning(prev => ({ ...prev, [type]: false }));
    }
  };

  return { running, runPipeline };
}
