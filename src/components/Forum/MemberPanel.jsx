import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Clock, Ban, Shield, Loader } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../lib/api';
import toast from 'react-hot-toast';

function UndoToast({ message, token, onDone }) {
  const [remaining, setRemaining] = useState(10);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(interval); onDone(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDone]);

  const handleUndo = async () => {
    try {
      await api.post('/admin/undo', { token });
      toast.success('Action undone');
      onDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Undo failed');
      onDone();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm">{message}</span>
      <button
        onClick={handleUndo}
        className="text-xs font-bold px-2 py-1 rounded"
        style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
      >
        Undo ({remaining}s)
      </button>
    </div>
  );
}

function TimeoutDialog({ member, onClose, onSuccess }) {
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/admin/users/${member._id}/timeout`, { durationMinutes: duration, reason });
      onSuccess(res.data.undoToken, `@${member.username} timed out for ${duration} min`);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to timeout user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card p-6 w-full max-w-sm" style={{ zIndex: 61 }}>
        <h3 className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          Timeout @{member.username}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Duration</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[5, 15, 60, 360, 1440].map((m) => (
                <button
                  key={m}
                  onClick={() => setDuration(m)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: duration === m ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: duration === m ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {m < 60 ? `${m}m` : m < 1440 ? `${m / 60}h` : '1d'}
                </button>
              ))}
            </div>
            <input type="number" className="input text-sm" value={duration}
              onChange={(e) => setDuration(Math.max(1, Math.min(43200, parseInt(e.target.value) || 1)))}
              min={1} max={43200} />
          </div>
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Reason (optional)</label>
            <input type="text" className="input text-sm" placeholder="Reason for timeout..."
              value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={submit} disabled={loading} className="btn-primary flex-1 text-sm"
              style={{ backgroundColor: 'rgb(234,179,8)' }}>
              {loading ? '…' : 'Apply Timeout'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MemberPanel() {
  const [members, setMembers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [timeoutTarget, setTimeoutTarget] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const searchTimeout = useRef(null);

  const fetchMembers = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const [membersRes, onlineRes] = await Promise.all([
        api.get('/admin/members', { params: { search: q, page: p, limit: 30, sort: 'role' } }),
        api.get('/admin/members/online'),
      ]);
      if (p === 1) setMembers(membersRes.data.users);
      else setMembers(prev => [...prev, ...membersRes.data.users]);
      setTotal(membersRes.data.pagination.total);
      setOnlineCount(onlineRes.data.count);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers('', 1); }, [fetchMembers]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setPage(1); fetchMembers(search, 1); }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search, fetchMembers]);

  const handleBanToggle = async (member) => {
    try {
      await api.put(`/admin/users/${member._id}`, { isBanned: !member.isBanned });
      setMembers(prev => prev.map(m => m._id === member._id ? { ...m, isBanned: !member.isBanned } : m));
      toast.success(member.isBanned ? 'User unbanned' : 'User banned');
      setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const showUndoToast = (token, message) => {
    toast.custom(
      (t) => (
        <div
          className={`px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${t.visible ? 'animate-slide-down' : ''}`}
          style={{ backgroundColor: 'rgb(234,179,8)', color: 'white', maxWidth: 360 }}
        >
          <UndoToast message={message} token={token} onDone={(wasUndo) => {
            toast.dismiss(t.id);
            if (wasUndo) fetchMembers(search, 1);
          }} />
        </div>
      ),
      { duration: 11000 }
    );
  };

  // Group members: admins first, then online members, then offline
  const admins = members.filter(m => m.role === 'admin');
  const regularOnline = members.filter(m => m.role !== 'admin' && m.isOnline);
  const regularOffline = members.filter(m => m.role !== 'admin' && !m.isOnline);

  const MemberRow = ({ member }) => (
    <button
      key={member._id}
      onClick={() => setSelected(selected?._id === member._id ? null : member)}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
      style={{ backgroundColor: selected?._id === member._id ? 'var(--bg-tertiary)' : 'transparent' }}
      onMouseEnter={e => { if (selected?._id !== member._id) e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
      onMouseLeave={e => { if (selected?._id !== member._id) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {/* Avatar with online dot */}
      <div className="relative flex-shrink-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: member.role === 'admin' ? 'var(--accent)' : 'rgba(99,102,241,0.5)' }}
        >
          {(member.username || '?')[0].toUpperCase()}
        </div>
        {member.isOnline && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: 'rgb(34,197,94)', borderColor: 'var(--bg-secondary)' }}
          />
        )}
        {!member.isOnline && (
          <div
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--bg-secondary)', border: '2px solid var(--bg-secondary)' }}
          />
        )}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-sm font-semibold truncate"
            style={{
              color: member.isBanned
                ? 'rgb(239,68,68)'
                : member.isTimedOut
                  ? 'rgb(234,179,8)'
                  : member.isOnline
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
            }}
          >
            {member.username}
          </span>
          {member.role === 'admin' && <Shield size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
        </div>
        {member.isBanned && <span className="text-[10px]" style={{ color: 'rgb(239,68,68)' }}>Banned</span>}
        {!member.isBanned && member.isTimedOut && <span className="text-[10px]" style={{ color: 'rgb(234,179,8)' }}>Timed out</span>}
      </div>
    </button>
  );

  const GroupLabel = ({ label, count }) => (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label} — {count}
      </span>
    </div>
  );

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ width: 260, borderLeft: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* Header */}
      <div className="px-3 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Members</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)' }}
          >
            {onlineCount} online
          </span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input text-sm pl-8 py-1.5"
            placeholder="Search members…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{total} member{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-1 pb-2">
        {loading && members.length === 0 ? (
          <div className="flex justify-center pt-8"><Loader size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
        ) : (
          <>
            {admins.length > 0 && (
              <>
                <GroupLabel label="Admins" count={admins.length} />
                {admins.map(m => <MemberRow key={m._id} member={m} />)}
              </>
            )}
            {regularOnline.length > 0 && (
              <>
                <GroupLabel label="Online" count={regularOnline.length} />
                {regularOnline.map(m => <MemberRow key={m._id} member={m} />)}
              </>
            )}
            {regularOffline.length > 0 && (
              <>
                <GroupLabel label="Offline" count={regularOffline.length} />
                {regularOffline.map(m => <MemberRow key={m._id} member={m} />)}
              </>
            )}
            {members.length === 0 && (
              <p className="text-sm text-center pt-8" style={{ color: 'var(--text-muted)' }}>No members found</p>
            )}
            {members.length < total && !loading && (
              <button
                onClick={() => { const next = page + 1; setPage(next); fetchMembers(search, next); }}
                className="w-full text-sm py-2 mt-1 font-medium"
                style={{ color: 'var(--accent)' }}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>

      {/* Selected user action panel */}
      {selected && (
        <div className="mx-2 mb-3 p-3 rounded-xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>@{selected.username}</span>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {selected.postCount || 0} posts · #{selected.publicId}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)' }}><X size={13} /></button>
          </div>
          <div className="flex flex-col gap-1.5">
            {selected.role !== 'admin' && (
              <>
                <button
                  onClick={() => { setTimeoutTarget(selected); setSelected(null); }}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors font-medium"
                  style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: 'rgb(234,179,8)' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(234,179,8,0.12)'}
                >
                  <Clock size={13} />
                  {selected.isTimedOut ? 'Adjust timeout' : 'Timeout user'}
                </button>
                {selected.isTimedOut && (
                  <button
                    onClick={async () => {
                      try {
                        await api.delete(`/admin/users/${selected._id}/timeout`);
                        setMembers(prev => prev.map(m => m._id === selected._id ? { ...m, isTimedOut: false, timeoutUntil: null } : m));
                        toast.success('Timeout removed');
                        setSelected(null);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed');
                      }
                    }}
                    className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors font-medium"
                    style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.12)'}
                  >
                    <X size={13} />
                    Remove timeout
                  </button>
                )}
                <button
                  onClick={() => handleBanToggle(selected)}
                  className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors font-medium"
                  style={{
                    backgroundColor: selected.isBanned ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                    color: selected.isBanned ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <Ban size={13} />
                  {selected.isBanned ? 'Unban user' : 'Ban user'}
                </button>
              </>
            )}
            {selected.role === 'admin' && (
              <p className="text-xs text-center py-1" style={{ color: 'var(--text-muted)' }}>Admins cannot be moderated</p>
            )}
          </div>
        </div>
      )}

      {timeoutTarget && (
        <TimeoutDialog
          member={timeoutTarget}
          onClose={() => setTimeoutTarget(null)}
          onSuccess={(token, msg) => showUndoToast(token, msg)}
        />
      )}
    </div>
  );
}
