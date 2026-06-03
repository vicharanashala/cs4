import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';

// ── constants ─────────────────────────────────────────────────────────────────
const CATEGORIES   = ['', 'auth', 'post', 'comment', 'vote', 'admin', 'system', 'security'];
const LEVELS       = ['', 'info', 'warn', 'error'];
const SEVERITIES   = ['', 'debug', 'info', 'warn', 'error', 'critical'];
const TARGET_TYPES = ['', 'Post', 'Comment', 'User', 'FAQ', 'Vote', 'Notification'];

const SEV = {
  debug:    { bg: 'rgba(148,163,184,0.12)', color: 'rgb(148,163,184)' },
  info:     { bg: 'rgba(99,102,241,0.14)',  color: 'var(--accent)'    },
  warn:     { bg: 'rgba(234,179,8,0.14)',   color: 'rgb(234,179,8)'   },
  error:    { bg: 'rgba(239,68,68,0.14)',   color: 'rgb(239,68,68)'   },
  critical: { bg: 'rgba(239,68,68,0.24)',   color: 'rgb(239,68,68)'   },
};
const CAT = {
  auth:     { bg: 'rgba(168,85,247,0.14)',  color: 'rgb(168,85,247)'  },
  post:     { bg: 'rgba(34,197,94,0.14)',   color: 'rgb(34,197,94)'   },
  comment:  { bg: 'rgba(99,102,241,0.14)',  color: 'var(--accent)'    },
  vote:     { bg: 'rgba(249,115,22,0.14)',  color: 'rgb(249,115,22)'  },
  admin:    { bg: 'rgba(239,68,68,0.14)',   color: 'rgb(239,68,68)'   },
  system:   { bg: 'rgba(148,163,184,0.12)', color: 'rgb(148,163,184)' },
  security: { bg: 'rgba(239,68,68,0.22)',   color: 'rgb(239,68,68)'   },
};
const httpColor = (c) => !c ? 'var(--text-muted)' : c < 300 ? 'rgb(34,197,94)' : c < 400 ? 'rgb(234,179,8)' : 'rgb(239,68,68)';
const methodColor = (m) => ({ GET:'rgb(34,197,94)', POST:'rgb(99,102,241)', PUT:'rgb(234,179,8)', PATCH:'rgb(234,179,8)', DELETE:'rgb(239,68,68)' }[m] || 'var(--text-muted)');

const TABLE_COLS = ['Timestamp', 'Sev / Cat', 'Action', 'User', 'IP Address', 'Request', 'Target', 'Dur'];

const SEL = {
  padding: '6px 10px', borderRadius: 8,
  border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', cursor: 'pointer',
};

// ── helpers ───────────────────────────────────────────────────────────────────
function Badge({ text, styles }) {
  if (!text) return null;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
      backgroundColor: styles?.bg ?? 'var(--bg-secondary)',
      color: styles?.color ?? 'var(--text-muted)',
    }}>{text}</span>
  );
}

function Field({ label, value, mono }) {
  if (value == null || value === '') return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : 'Montserrat, sans-serif' }}>
        {String(value)}
      </div>
    </div>
  );
}

function SectionGrid({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--accent)', marginBottom: 6, paddingBottom: 4,
        borderBottom: '1px solid var(--border-subtle)',
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2px 20px' }}>
        {children}
      </div>
    </div>
  );
}

function SectionFull({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
        color: 'var(--accent)', marginBottom: 6, paddingBottom: 4,
        borderBottom: '1px solid var(--border-subtle)',
      }}>{title}</div>
      {children}
    </div>
  );
}

function JsonBlock({ data }) {
  if (data == null) return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>;
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (!str || str === '{}' || str === '[]' || str === 'null') return <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>;
  return (
    <pre style={{
      margin: 0, fontSize: 11, fontFamily: 'monospace',
      color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)',
      border: '1px solid var(--border-subtle)', borderRadius: 6,
      padding: '8px 10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      maxHeight: 240, overflowY: 'auto',
    }}>{str}</pre>
  );
}

function hasData(obj) {
  return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
}

// ── expanded detail row ───────────────────────────────────────────────────────
function ExpandedPanel({ log, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ backgroundColor: 'rgba(99,102,241,0.04)', borderBottom: '2px solid var(--accent)', padding: '16px 20px' }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

          {/* ── Identity ── */}
          <SectionGrid title="Identity">
            <Field label="Username"        value={log.username} />
            <Field label="Email"           value={log.userEmail}    mono />
            <Field label="Role"            value={log.userRole} />
            <Field label="User ID (Mongo)" value={log.userId}       mono />
            <Field label="Public ID"       value={log.userPublicId} mono />
          </SectionGrid>

          {/* ── Network & Device ── */}
          {(log.ip || log.userAgent || log.origin || log.referer || log.sessionHint || log.deviceBrand || log.deviceFingerprint) && (
            <SectionGrid title="Network & Device">
              <Field label="IP Address"         value={log.ip}                mono />
              <Field label="Device Brand"       value={log.deviceBrand} />
              <Field label="Device Model"       value={log.deviceModel} />
              <Field label="Device OS"          value={log.deviceOs} />
              <Field label="Device Fingerprint" value={log.deviceFingerprint} mono />
              <Field label="User Agent"         value={log.userAgent} />
              <Field label="Origin"             value={log.origin}            mono />
              <Field label="Referer"            value={log.referer}           mono />
              <Field label="Session Hint"       value={log.sessionHint}       mono />
            </SectionGrid>
          )}

          {/* ── Request ── */}
          {(log.method || log.path || log.statusCode) && (
            <SectionGrid title="Request">
              <Field label="Method"      value={log.method} />
              <Field label="Path"        value={log.path}         mono />
              <Field label="Status Code" value={log.statusCode} />
              <Field label="Duration"    value={log.durationMs != null ? `${log.durationMs} ms` : null} />
            </SectionGrid>
          )}

          {/* ── Target ── */}
          {log.targetType && (
            <SectionGrid title="Target">
              <Field label="Type"      value={log.targetType} />
              <Field label="Target ID" value={log.targetId}  mono />
            </SectionGrid>
          )}

          {/* ── Event ── */}
          <SectionGrid title="Event Metadata">
            <Field label="Category"  value={log.category} />
            <Field label="Action"    value={log.action} />
            <Field label="Level"     value={log.level} />
            <Field label="Severity"  value={log.severity} />
            <Field label="Tags"      value={log.tags?.length ? log.tags.join(', ') : null} />
            <Field label="Timestamp" value={format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss.SSS')} mono />
          </SectionGrid>

          {/* ── Target Snapshot ── */}
          {hasData(log.targetSnapshot) && (
            <SectionFull title="Target Snapshot">
              <JsonBlock data={log.targetSnapshot} />
            </SectionFull>
          )}

          {/* ── Query Params ── */}
          {hasData(log.query) && (
            <SectionFull title="Query Params">
              <JsonBlock data={log.query} />
            </SectionFull>
          )}

          {/* ── Request Body ── */}
          {hasData(log.body) && (
            <SectionFull title="Request Body">
              <JsonBlock data={log.body} />
            </SectionFull>
          )}

          {/* ── Details ── */}
          <SectionFull title="Details">
            <JsonBlock data={log.details} />
          </SectionFull>

        </div>
      </td>
    </tr>
  );
}

// ── main component ────────────────────────────────────────────────────────────
const METHODS = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export default function LogViewer() {
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [expanded, setExpanded]     = useState(null);

  // Row 1 — dropdown filters
  const [search,     setSearch]     = useState('');
  const [category,   setCategory]   = useState('');
  const [level,      setLevel]      = useState('');
  const [severity,   setSeverity]   = useState('');
  const [targetType, setTargetType] = useState('');
  const [method,     setMethod]     = useState('');

  // Row 2 — specific field filters
  const [fUsername,    setFUsername]    = useState('');
  const [fEmail,       setFEmail]       = useState('');
  const [fIp,          setFIp]          = useState('');
  const [fAction,      setFAction]      = useState('');
  const [fPublicId,    setFPublicId]    = useState('');
  const [fDevice,      setFDevice]      = useState('');
  const [fDateFrom,    setFDateFrom]    = useState('');
  const [fDateTo,      setFDateTo]      = useState('');

  const hasSpecific = fUsername || fEmail || fIp || fAction || fPublicId || fDevice || fDateFrom || fDateTo;

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 50 });
      if (search)     p.set('search',     search);
      if (category)   p.set('category',   category);
      if (level)      p.set('level',      level);
      if (severity)   p.set('severity',   severity);
      if (targetType) p.set('targetType', targetType);
      if (method)     p.set('method',     method);
      if (fUsername)  p.set('username',   fUsername);
      if (fEmail)     p.set('userEmail',  fEmail);
      if (fIp)        p.set('ip',         fIp);
      if (fAction)    p.set('action',     fAction);
      if (fPublicId)  p.set('userPublicId', fPublicId);
      if (fDevice)    p.set('deviceBrand', fDevice);
      if (fDateFrom)  p.set('dateFrom',   fDateFrom);
      if (fDateTo)    p.set('dateTo',     fDateTo);
      const res = await api.get(`/admin/logs?${p}`);
      setLogs(res.data.logs);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, category, level, severity, targetType, method,
      fUsername, fEmail, fIp, fAction, fPublicId, fDevice, fDateFrom, fDateTo]);

  useEffect(() => {
    const t = setTimeout(() => fetchLogs(1), 300);
    return () => clearTimeout(t);
  }, [fetchLogs]);

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Logs{' '}
          <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}>
            ({pagination.total.toLocaleString()})
          </span>
        </h2>
        <button
          onClick={() => fetchLogs(pagination.page)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, ...SEL, fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Filter row 1: broad search + dropdowns ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Broad search — action, user, IP, device, path…"
            style={{ ...SEL, width: '100%', paddingLeft: 32, boxSizing: 'border-box' }}
          />
        </div>
        <select style={SEL} value={category}   onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c || 'All categories'}</option>)}
        </select>
        <select style={SEL} value={level}      onChange={(e) => setLevel(e.target.value)}>
          {LEVELS.map((l) => <option key={l} value={l}>{l || 'All levels'}</option>)}
        </select>
        <select style={SEL} value={severity}   onChange={(e) => setSeverity(e.target.value)}>
          {SEVERITIES.map((s) => <option key={s} value={s}>{s || 'All severity'}</option>)}
        </select>
        <select style={SEL} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
          {TARGET_TYPES.map((t) => <option key={t} value={t}>{t || 'All targets'}</option>)}
        </select>
        <select style={SEL} value={method}     onChange={(e) => setMethod(e.target.value)}>
          {METHODS.map((m) => <option key={m} value={m}>{m || 'All methods'}</option>)}
        </select>
      </div>

      {/* ── Filter row 2: specific field filters ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {[
          { ph: 'Username',  val: fUsername, set: setFUsername },
          { ph: 'Email',     val: fEmail,    set: setFEmail    },
          { ph: 'IP address',val: fIp,       set: setFIp       },
          { ph: 'Action',    val: fAction,   set: setFAction   },
          { ph: 'Public ID', val: fPublicId, set: setFPublicId },
          { ph: 'Device brand', val: fDevice, set: setFDevice  },
        ].map(({ ph, val, set }) => (
          <input
            key={ph}
            type="text"
            value={val}
            onChange={(e) => set(e.target.value)}
            placeholder={ph}
            style={{ ...SEL, flex: '1 1 120px', minWidth: 110 }}
          />
        ))}
        <input
          type="date"
          value={fDateFrom}
          onChange={(e) => setFDateFrom(e.target.value)}
          title="Date from"
          style={{ ...SEL, flex: '0 0 auto', color: fDateFrom ? 'var(--text-primary)' : 'var(--text-muted)' }}
        />
        <input
          type="date"
          value={fDateTo}
          onChange={(e) => setFDateTo(e.target.value)}
          title="Date to"
          style={{ ...SEL, flex: '0 0 auto', color: fDateTo ? 'var(--text-primary)' : 'var(--text-muted)' }}
        />
        {(search || category || level || severity || targetType || method || hasSpecific) && (
          <button
            onClick={() => {
              setSearch(''); setCategory(''); setLevel(''); setSeverity('');
              setTargetType(''); setMethod('');
              setFUsername(''); setFEmail(''); setFIp(''); setFAction('');
              setFPublicId(''); setFDevice(''); setFDateFrom(''); setFDateTo('');
            }}
            style={{ ...SEL, color: 'rgb(239,68,68)', borderColor: 'rgba(239,68,68,0.3)', whiteSpace: 'nowrap' }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                {TABLE_COLS.map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px', whiteSpace: 'nowrap',
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: 'var(--text-muted)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(12)].map((_, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {TABLE_COLS.map((_, j) => (
                        <td key={j} style={{ padding: '10px 14px' }}>
                          <div className="skeleton" style={{ height: 11, borderRadius: 4, width: j === 0 ? '90px' : j === 2 ? '120px' : '60%' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : logs.map((log) => (
                    <>
                      <tr
                        key={log._id}
                        onClick={() => setExpanded((p) => p === log._id ? null : log._id)}
                        style={{
                          borderBottom: expanded === log._id ? 'none' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          backgroundColor: expanded === log._id ? 'rgba(99,102,241,0.06)' : 'transparent',
                          transition: 'background 80ms ease',
                        }}
                        onMouseEnter={(e) => { if (expanded !== log._id) e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                        onMouseLeave={(e) => { if (expanded !== log._id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {/* Timestamp */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600 }}>
                            {format(new Date(log.createdAt), 'yyyy-MM-dd')}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {format(new Date(log.createdAt), 'HH:mm:ss.SSS')}
                          </div>
                        </td>

                        {/* Sev / Cat */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <Badge text={log.severity || log.level} styles={SEV[log.severity] ?? SEV[log.level]} />
                            <Badge text={log.category}              styles={CAT[log.category]} />
                          </div>
                        </td>

                        {/* Action */}
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          {log.action}
                        </td>

                        {/* User — username + email + role + device stacked */}
                        <td style={{ padding: '10px 14px', minWidth: 160 }}>
                          {log.username
                            ? <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{log.username}</div>
                            : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</div>}
                          {log.userEmail && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{log.userEmail}</div>
                          )}
                          {log.userRole && (
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginTop: 1, letterSpacing: '0.06em' }}>
                              {log.userRole}
                            </div>
                          )}
                          {(log.deviceBrand || log.deviceModel) && (
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              {[log.deviceBrand, log.deviceModel].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </td>

                        {/* IP */}
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {log.ip || '—'}
                        </td>

                        {/* Request — method + path + status */}
                        <td style={{ padding: '10px 14px', minWidth: 180 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {log.method && (
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 10, color: methodColor(log.method) }}>
                                {log.method}
                              </span>
                            )}
                            <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                              {log.path || '—'}
                            </span>
                          </div>
                          {log.statusCode != null && (
                            <div style={{ marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}>
                              <span style={{ fontWeight: 700, color: httpColor(log.statusCode) }}>{log.statusCode}</span>
                              {log.durationMs != null && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{log.durationMs}ms</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Target */}
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 11 }}>
                          {log.targetType
                            ? <>
                                <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{log.targetType}</div>
                                <div style={{ color: 'var(--text-muted)' }}>…{String(log.targetId || '').slice(-8)}</div>
                              </>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>

                        {/* Duration */}
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                        </td>
                      </tr>

                      {expanded === log._id && (
                        <ExpandedPanel key={`${log._id}-exp`} log={log} colSpan={TABLE_COLS.length} />
                      )}
                    </>
                  ))}
            </tbody>
          </table>

          {!loading && logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)', fontSize: 13 }}>
              No logs found
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--bg-secondary)', fontSize: 12,
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Page {pagination.page} of {pagination.pages} · {pagination.total.toLocaleString()} entries
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => fetchLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                style={{ ...SEL, padding: '4px 12px', fontSize: 12, opacity: pagination.page <= 1 ? 0.4 : 1 }}
              >Prev</button>
              <button
                onClick={() => fetchLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                style={{ ...SEL, padding: '4px 12px', fontSize: 12, opacity: pagination.page >= pagination.pages ? 0.4 : 1 }}
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
