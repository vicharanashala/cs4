import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  unresolved: { bg: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', label: 'Unresolved' },
  in_progress: { bg: 'rgba(59,130,246,0.12)', color: 'rgb(59,130,246)', label: 'In Progress' },
  resolved:   { bg: 'rgba(34,197,94,0.12)',  color: 'rgb(34,197,94)',  label: 'Resolved' },
};

const TREND_MAP = {
  up:   { symbol: '↑', color: 'rgb(239,68,68)', title: 'Trending up' },
  flat: { symbol: '→', color: 'var(--text-muted)', title: 'Stable' },
  down: { symbol: '↓', color: 'rgb(34,197,94)', title: 'Trending down' },
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

// ── sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, palette }) {
  const PALETTES = {
    accent:  { bg: 'var(--accent-light)',      fg: 'var(--accent)' },
    warn:    { bg: 'rgba(245,158,11,0.12)',    fg: 'rgb(245,158,11)' },
    danger:  { bg: 'rgba(239,68,68,0.12)',     fg: 'rgb(239,68,68)' },
    success: { bg: 'rgba(34,197,94,0.12)',     fg: 'rgb(34,197,94)' },
  };
  const { fg } = PALETTES[palette] ?? PALETTES.accent;
  return (
    <div className="card p-5">
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: fg }}>{value ?? '—'}</p>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="card p-5 animate-pulse" style={{ marginBottom: '0.75rem' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-48 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        <div className="h-5 w-20 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }} />
      </div>
      <div className="h-4 w-full rounded mt-2" style={{ backgroundColor: 'var(--bg-secondary)' }} />
      <div className="h-4 w-3/4 rounded mt-2" style={{ backgroundColor: 'var(--bg-secondary)' }} />
    </div>
  );
}

function StatusDropdown({ clusterId, currentStatus, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const options = [
    { value: 'unresolved', label: 'Mark Unresolved' },
    { value: 'in_progress', label: 'Mark In Progress' },
    { value: 'resolved', label: 'Mark Resolved' },
  ].filter((o) => o.value !== currentStatus);

  const handleSelect = async (value) => {
    setOpen(false);
    try {
      await api.patch(`/admin/search-gaps/${clusterId}/status`, { status: value });
      onStatusChange(clusterId, value);
      toast.success(`Cluster marked as ${STATUS_STYLES[value].label}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          border: '1px solid var(--border)',
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-secondary)',
        }}
      >
        Actions <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onMouseDown={() => setOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 4px)',
              zIndex: 50,
              minWidth: '160px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt.value); }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ClusterCard({ cluster, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_STYLES[cluster.status] ?? STATUS_STYLES.unresolved;
  const trend       = TREND_MAP[cluster.trendIndicator] ?? TREND_MAP.flat;
  const samples     = cluster.sampleQueries || [];
  const visibleSamples = expanded ? samples : samples.slice(0, 3);

  return (
    <div
      className="card p-5"
      style={{ marginBottom: '0.75rem', fontFamily: 'Montserrat, sans-serif' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              {cluster.label}
            </span>
            <span
              title={trend.title}
              style={{ fontSize: '18px', color: trend.color, fontWeight: 700, lineHeight: 1 }}
            >
              {trend.symbol}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '99px',
                backgroundColor: statusStyle.bg,
                color: statusStyle.color,
              }}
            >
              {statusStyle.label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              First seen: {cluster.firstSeen ? formatDistanceToNow(new Date(cluster.firstSeen), { addSuffix: true }) : '—'}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Last seen: {cluster.lastSeen ? formatDistanceToNow(new Date(cluster.lastSeen), { addSuffix: true }) : '—'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 }}>
              {cluster.queryCount?.toLocaleString() ?? 0}
            </p>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              searches
            </p>
          </div>
          <StatusDropdown
            clusterId={cluster._id}
            currentStatus={cluster.status}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>

      {/* Sample queries */}
      {samples.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Sample queries
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {visibleSamples.map((q, i) => (
              <span
                key={i}
                style={{
                  fontSize: '12px',
                  padding: '3px 9px',
                  borderRadius: '99px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'monospace',
                }}
              >
                {q}
              </span>
            ))}
            {samples.length > 3 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                style={{
                  fontSize: '12px',
                  color: 'var(--accent)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '3px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                {expanded
                  ? <><ChevronUp size={12} /> show less</>
                  : <><ChevronDown size={12} /> +{samples.length - 3} more</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function SearchGapTracker() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [clustering, setClustering] = useState(false);
  const [clusterMsg, setClusterMsg] = useState(null);

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: pg, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/search-gaps', { params });
      setData(res.data);
      setPage(pg);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load search gaps');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleTriggerClustering = useCallback(async () => {
    setClustering(true);
    setClusterMsg(null);
    try {
      const res = await api.post('/admin/search-gaps/trigger-clustering');
      const { assigned, clusterCount } = res.data;
      setClusterMsg(`Done — ${assigned} quer${assigned === 1 ? 'y' : 'ies'} assigned across ${clusterCount} cluster${clusterCount === 1 ? '' : 's'}`);
      fetchData(1);
    } catch {
      setClusterMsg('Clustering failed — check server logs');
    } finally {
      setClustering(false);
    }
  }, [fetchData]);

  const handleStatusChange = useCallback((clusterId, newStatus) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        clusters: prev.clusters.map((c) =>
          c._id === clusterId ? { ...c, status: newStatus } : c
        ),
      };
    });
  }, []);

  const { summary, clusters, pagination } = data || {};

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: clusterMsg ? '10px' : '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Search Gap Tracker
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleTriggerClustering}
            disabled={clustering}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: clustering ? 'not-allowed' : 'pointer',
              border: '1px solid var(--accent)',
              backgroundColor: clustering ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.12)',
              color: 'var(--accent)',
              opacity: clustering ? 0.7 : 1,
              transition: 'all 150ms ease',
            }}
          >
            <Zap size={13} style={{ animation: clustering ? 'spin 1s linear infinite' : 'none' }} />
            {clustering ? 'Clustering…' : 'Run Clustering'}
          </button>
          <button
            onClick={() => fetchData(page)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>
      {clusterMsg && (
        <div style={{
          marginBottom: '16px',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '13px',
          backgroundColor: clusterMsg.includes('failed') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          color: clusterMsg.includes('failed') ? 'rgb(239,68,68)' : 'rgb(34,197,94)',
          border: `1px solid ${clusterMsg.includes('failed') ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
        }}>
          {clusterMsg}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <SummaryCard label="Dead-ends this week" value={summary?.totalDeadEnds} palette="danger" />
        <SummaryCard label="Distinct clusters"   value={summary?.distinctClusters} palette="accent" />
        <SummaryCard label="Unresolved clusters" value={summary?.unresolvedClusters} palette="warn" />
        <SummaryCard label="Resolved this month" value={summary?.resolvedThisMonth} palette="success" />
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            style={{
              padding: '5px 14px',
              borderRadius: '99px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: statusFilter === f.value ? 'var(--accent)' : 'var(--border)',
              backgroundColor: statusFilter === f.value ? 'var(--accent)' : 'transparent',
              color: statusFilter === f.value ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'rgb(239,68,68)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Cluster list */}
      {loading ? (
        [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
      ) : clusters?.length === 0 ? (
        <div
          className="card"
          style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}
        >
          <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, marginBottom: '4px' }}>No clusters found</p>
          <p>No search gap clusters match the current filter.</p>
        </div>
      ) : (
        clusters?.map((cluster) => (
          <ClusterCard
            key={cluster._id}
            cluster={cluster}
            onStatusChange={handleStatusChange}
          />
        ))
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-card)',
            fontSize: '13px',
          }}
        >
          <span style={{ color: 'var(--text-muted)' }}>
            Page {pagination.page} of {pagination.pages} ({pagination.total} total)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => fetchData(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-secondary"
              style={{ padding: '4px 12px', fontSize: '12px', opacity: pagination.page <= 1 ? 0.4 : 1 }}
            >
              Prev
            </button>
            <button
              onClick={() => fetchData(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="btn-secondary"
              style={{ padding: '4px 12px', fontSize: '12px', opacity: pagination.page >= pagination.pages ? 0.4 : 1 }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
