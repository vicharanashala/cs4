import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, X, SearchX } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import api from '../../lib/api';
import { useTheme } from '../../context/ThemeContext';
import { getOrCreateSessionId, normalizeQuery as normalizeQueryUtil } from '../../lib/deviceFingerprint';

const POST_TAGS = [
  'About VINS', 'Timing & Dates', 'NOC', 'Selection & Offer',
  'Work & Mentorship', 'Code of Conduct', 'Interviews', 'Certificate',
  'Rosetta', 'Phase 1 & ViBe', 'Yaksha Chat', 'ViBe Platform',
  'Team Formation', 'General', 'Technical', 'Help Needed', 'Announcements', 'Off-topic',
  'Ignored Similar Post',
];

const HAS_OPTIONS = [
  { value: 'image',    label: 'Image' },
  { value: 'comments', label: 'Comments' },
  { value: 'votes',    label: 'Votes' },
];

const FILTER_PILLS = [
  { id: 'from',   label: 'From User' },
  { id: 'tag',    label: 'Tag' },
  { id: 'has',    label: 'Has' },
  { id: 'before', label: 'Before' },
  { id: 'after',  label: 'After' },
];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Module-level: persists across modal open/close within the same page load
const _sessionLoggedDeadEnds = new Set();
const _getOrCreateSessionId = getOrCreateSessionId;
const _normalizeQuery = normalizeQueryUtil;

function highlightText(text, query) {
  if (!query || !text) return text;
  const esc = escapeRegex(query);
  const parts = text.split(new RegExp(`(${esc})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <span key={i} style={{ backgroundColor: 'rgba(99,102,241,0.28)', borderRadius: 3, padding: '0 1px' }}>{part}</span>
      : part
  );
}

function chipDateLabel(key, value) {
  try { return `${key}: ${format(new Date(value), 'd MMM yyyy')}`; }
  catch { return `${key}: ${value}`; }
}

function chipLabel(key, value) {
  if (key === 'before' || key === 'after') return chipDateLabel(key, value);
  return `${key}: ${value}`;
}

function ActiveChip({ label, onRemove }) {
  const [exiting, setExiting] = useState(false);
  const handleRemove = () => { setExiting(true); setTimeout(onRemove, 120); };
  return (
    <div style={{
      display: 'inline-flex',
      maxWidth: exiting ? 0 : 300,
      opacity: exiting ? 0 : 1,
      overflow: 'hidden',
      transition: 'max-width 120ms ease-in, opacity 120ms ease-in',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px',
        background: 'rgba(99,102,241,0.14)',
        border: '1px solid rgba(99,102,241,0.32)',
        borderRadius: 100,
        fontSize: 12, color: 'var(--accent)', whiteSpace: 'nowrap',
        animation: 'smChipEnter 150ms ease-out both',
      }}>
        {label}
        <button
          onClick={handleRemove}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0, background: 'none', border: 'none', color: 'var(--accent)' }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function FromUserDropdown({ onSelect, isDark }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/search', { params: { q } });
        setUsers(res.data.users || []);
      } catch { setUsers([]); }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  return (
    <div style={{ padding: 8 }}>
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users…"
        style={{
          width: '100%', padding: '6px 10px', marginBottom: 6,
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
          borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none',
        }}
      />
      {users.slice(0, 6).map((u) => (
        <button
          key={u._id || u.username}
          onMouseDown={(e) => { e.preventDefault(); onSelect(u.username); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 10px', borderRadius: 8, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(99,102,241,0.2)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            {u.username[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>@{u.username}</span>
        </button>
      ))}
    </div>
  );
}

function FilterDropdown({ type, onSelect, isDark }) {
  const dropBg   = isDark ? 'rgba(16,16,30,0.97)'    : 'rgba(248,248,255,0.97)';
  const dropBdr  = isDark ? 'rgba(255,255,255,0.09)'  : 'rgba(0,0,0,0.09)';
  const hoverBg  = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.05)';

  const dropdownStyle = {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
    borderRadius: 14, overflow: 'hidden', minWidth: 220,
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    border: `1px solid ${dropBdr}`,
    boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.7)' : '0 16px 48px rgba(80,80,160,0.15)',
    backgroundColor: dropBg,
  };

  const optBtnStyle = {
    width: '100%', padding: '8px 12px', cursor: 'pointer', background: 'none',
    border: 'none', textAlign: 'left', fontSize: 13, color: 'var(--text-primary)',
  };

  if (type === 'tag') {
    return (
      <div style={dropdownStyle}>
        <div style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
          {POST_TAGS.map((tag) => (
            <button
              key={tag}
              onMouseDown={(e) => { e.preventDefault(); onSelect(tag); }}
              style={optBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'has') {
    return (
      <div style={dropdownStyle}>
        <div style={{ padding: 4 }}>
          {HAS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onMouseDown={(e) => { e.preventDefault(); onSelect(opt.value); }}
              style={optBtnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'from') {
    return (
      <div style={dropdownStyle}>
        <FromUserDropdown onSelect={onSelect} isDark={isDark} />
      </div>
    );
  }

  if (type === 'before' || type === 'after') {
    return (
      <div style={{ ...dropdownStyle, padding: 14 }}>
        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          {type === 'before' ? 'Posts before:' : 'Posts after:'}
        </label>
        <input
          type="date"
          autoFocus
          style={{
            background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none',
            fontSize: 14, cursor: 'pointer',
          }}
          onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
        />
      </div>
    );
  }

  return null;
}

function SkeletonCard() {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 13, width: '80%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

export default function SearchModal({ onClose }) {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [query, setQuery]               = useState('');
  const [filters, setFilters]           = useState({ from: '', tag: '', has: '', before: '', after: '' });
  const [results, setResults]           = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [activeFilterPill, setActiveFilterPill] = useState(null);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');

  const filterRowRef  = useRef(null);
  const inputRef      = useRef(null);
  const debounceRef   = useRef(null);
  const deadEndTimerRef = useRef(null);
  const noClickTimerRef = useRef(null);

  const panelBg      = isDark ? 'rgba(12,12,24,0.82)'    : 'rgba(255,255,255,0.72)';
  const panelBorder  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
  const dividerColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    const activeValues = Object.values(filters).filter(Boolean);
    if (!query.trim() && !activeValues.length) {
      setResults([]);
      setTotal(0);
      setLastSearchedQuery('');
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim())   params.set('q',      query.trim());
        if (filters.from)   params.set('from',   filters.from);
        if (filters.tag)    params.set('tag',    filters.tag);
        if (filters.has)    params.set('has',    filters.has);
        if (filters.before) params.set('before', filters.before);
        if (filters.after)  params.set('after',  filters.after);
        const res = await api.get(`/forum/search?${params}`);
        setResults(res.data.posts || []);
        setTotal(res.data.total || 0);
        setLastSearchedQuery(query);
      } catch {
        setError('Search failed — try again');
      } finally {
        setLoading(false);
      }
    }, 80);
    return () => clearTimeout(debounceRef.current);
  }, [query, filters]);

  useEffect(() => {
    if (!activeFilterPill) return;
    const handler = (e) => {
      if (filterRowRef.current && !filterRowRef.current.contains(e.target)) {
        setActiveFilterPill(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeFilterPill]);

  const setFilter    = useCallback((key, value) => { setFilters((f) => ({ ...f, [key]: value })); setActiveFilterPill(null); }, []);
  const removeFilter = useCallback((key) => { setFilters((f) => ({ ...f, [key]: '' })); }, []);

  const logDeadEnd = useCallback(async (rawQuery, outcomeType) => {
    const norm = _normalizeQuery(rawQuery);
    if (norm.length < 3 || /^\d+$/.test(norm) || _sessionLoggedDeadEnds.has(norm)) return;
    _sessionLoggedDeadEnds.add(norm);
    try {
      await api.post('/forum/dead-end', {
        query: rawQuery,
        normalizedQuery: norm,
        outcomeType,
        sessionId: _getOrCreateSessionId(),
      });
    } catch {
      _sessionLoggedDeadEnds.delete(norm);
    }
  }, []);

  // Dead-end detection: fires after search settles
  useEffect(() => {
    clearTimeout(deadEndTimerRef.current);
    clearTimeout(noClickTimerRef.current);

    if (loading || error || !lastSearchedQuery) return;

    const norm = _normalizeQuery(lastSearchedQuery);
    if (norm.length < 3 || /^\d+$/.test(norm) || _sessionLoggedDeadEnds.has(norm)) return;

    if (results.length === 0) {
      // Zero-result dead-end: log after 800ms of query stability
      deadEndTimerRef.current = setTimeout(() => {
        logDeadEnd(lastSearchedQuery, 'zero_results');
      }, 800);
    } else {
      // No-click dead-end: log if user doesn't click any result within 15s
      noClickTimerRef.current = setTimeout(() => {
        logDeadEnd(lastSearchedQuery, 'no_click');
      }, 15000);
    }

    return () => {
      clearTimeout(deadEndTimerRef.current);
      clearTimeout(noClickTimerRef.current);
    };
  }, [results, loading, error, lastSearchedQuery, logDeadEnd]);

  const activeFilters = Object.entries(filters).filter(([, v]) => v);
  const hasResults    = results.length > 0;
  const showEmpty     = !loading && !error && !hasResults && (query.trim() || activeFilters.length > 0);

  const pillBg      = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const pillBdr     = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const pillActiveBg= 'rgba(99,102,241,0.18)';
  const pillActiveBdr='rgba(99,102,241,0.38)';

  const pillStyle = (active, hasValue) => ({
    padding: '4px 12px',
    background: (active || hasValue) ? pillActiveBg : pillBg,
    border: `1px solid ${(active || hasValue) ? pillActiveBdr : pillBdr}`,
    borderRadius: 100,
    fontSize: 12,
    color: (active || hasValue) ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontWeight: (active || hasValue) ? 600 : 400,
    transition: 'all 120ms ease',
  });

  return createPortal(
    <>
      <style>{`
        @keyframes smModalEnter {
          from { opacity: 0; transform: scale(0.96) translateY(-10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }
        @keyframes smFadeSlideUp {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes smChipEnter {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0);    }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(60,60,120,0.3)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '8vh',
        }}
      >
        {/* Panel */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: 'calc(100vw - 32px)',
            maxWidth: 680,
            backgroundColor: panelBg,
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: `1px solid ${panelBorder}`,
            boxShadow: isDark
              ? '0 32px 80px rgba(0,0,0,0.7), inset 0 0.5px 0 rgba(255,255,255,0.08)'
              : '0 32px 80px rgba(80,80,160,0.2), inset 0 0.5px 0 rgba(255,255,255,0.9)',
            borderRadius: 20,
            overflow: 'visible',
            animation: 'smModalEnter 200ms cubic-bezier(0.34,1.56,0.64,1) both',
          }}
        >
          {/* Search input row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px',
            borderBottom: `1px solid ${dividerColor}`,
          }}>
            <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search posts…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Montserrat, system-ui, sans-serif',
                fontWeight: 500,
              }}
            />
            <kbd style={{
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
              borderRadius: 7, padding: '3px 8px',
              fontSize: 11, color: 'var(--text-muted)',
              fontFamily: 'monospace', flexShrink: 0,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}>
              Ctrl+K
            </kbd>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto',
              padding: '10px 16px',
              borderBottom: `1px solid ${dividerColor}`,
              scrollbarWidth: 'none',
            }}>
              {activeFilters.map(([key, value]) => (
                <ActiveChip key={key} label={chipLabel(key, value)} onRemove={() => removeFilter(key)} />
              ))}
            </div>
          )}

          {/* Filter builder row */}
          <div
            ref={filterRowRef}
            style={{ position: 'relative', zIndex: 100, padding: '10px 16px', borderBottom: `1px solid ${dividerColor}` }}
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTER_PILLS.map((pill) => {
                const isActive  = activeFilterPill === pill.id;
                const hasValue  = !!filters[pill.id];
                return (
                  <button
                    key={pill.id}
                    onMouseDown={(e) => { e.preventDefault(); setActiveFilterPill(isActive ? null : pill.id); }}
                    style={pillStyle(isActive, hasValue)}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
            {activeFilterPill && (
              <FilterDropdown
                type={activeFilterPill}
                onSelect={(value) => setFilter(activeFilterPill, value)}
                isDark={isDark}
              />
            )}
          </div>

          {/* Results */}
          <div>
            {(loading || hasResults || showEmpty || error) && (
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                padding: '8px 16px 4px', fontSize: 12, color: 'var(--text-muted)',
              }}>
                {loading ? 'Searching…' : error ? error : `${total.toLocaleString()} result${total !== 1 ? 's' : ''}`}
              </div>
            )}

            <div style={{ maxHeight: 400, overflowY: 'auto' }} className="scrollbar-thin">
              {loading ? (
                [1, 2, 3].map((i) => <SkeletonCard key={i} />)
              ) : showEmpty ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '48px 24px', gap: 12,
                }}>
                  <SearchX size={32} style={{ color: 'var(--text-muted)' }} />
                  <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>No posts found</p>
                  {activeFilters.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Filtering by: {activeFilters.map(([k, v]) => chipLabel(k, v)).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                results.map((post, i) => (
                  <div
                    key={post._id}
                    onClick={() => { clearTimeout(noClickTimerRef.current); navigate(`/forum/${post._id}`); onClose(); }}
                    style={{
                      padding: '12px 16px',
                      borderBottom: `1px solid ${dividerColor}`,
                      cursor: 'pointer',
                      animation: `smFadeSlideUp 200ms ease-out ${i * 22}ms both`,
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(99,102,241,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                  >
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(99,102,241,0.18)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {(post.author?.username || '?')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                            {post.author?.username}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                          {highlightText(post.title, query)}
                        </div>
                        {post.description && (
                          <div style={{
                            fontSize: 13, color: 'var(--text-secondary)',
                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>
                            {highlightText(post.description, query)}
                          </div>
                        )}
                        {post.tags?.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                            {post.tags.map((tag) => <span key={tag} className="tag" style={{ fontSize: 10 }}>{tag}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
