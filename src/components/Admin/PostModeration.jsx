import { useState, useEffect, useCallback } from 'react';
import { Search, Eye, EyeOff, ExternalLink, Archive, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

function UndoBanner({ token, message, onExpire, onUndo }) {
  const [remaining, setRemaining] = useState(10);

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); onExpire(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [onExpire]);

  const handleUndo = async () => {
    try {
      await api.post('/admin/undo', { token });
      toast.success('Action undone');
      onUndo();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Undo failed');
      onExpire();
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4"
      style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}
    >
      <span className="text-sm" style={{ color: 'rgb(234,179,8)' }}>{message}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'rgb(234,179,8)', opacity: 0.7 }}>{remaining}s</span>
        <button
          onClick={handleUndo}
          className="text-xs font-bold px-3 py-1 rounded-lg"
          style={{ backgroundColor: 'rgba(234,179,8,0.2)', color: 'rgb(234,179,8)' }}
        >
          Undo
        </button>
      </div>
    </div>
  );
}

export default function PostModeration() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [undo, setUndo] = useState(null);

  const fetchPosts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/posts', { params: { page, limit: 20, showHidden, search } });
      setPosts(res.data.posts);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, showHidden]);

  useEffect(() => {
    const t = setTimeout(() => fetchPosts(1), 300);
    return () => clearTimeout(t);
  }, [fetchPosts]);

  const handleToggleHide = async (post) => {
    const hide = !post.isHidden;
    const reason = hide ? (window.prompt('Reason for hiding (optional):') ?? '') : undefined;
    try {
      const res = await api.put(`/admin/posts/${post._id}/hide`, { hide, reason });
      setPosts((ps) => ps.map((p) => p._id === post._id ? { ...p, isHidden: hide } : p));
      if (hide && res.data.undoToken) {
        setUndo({ token: res.data.undoToken, message: 'Post hidden' });
      }
      toast.success(hide ? 'Post hidden' : 'Post restored');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleArchive = async (post) => {
    const archive = !post.isArchived;
    const reason = archive ? (window.prompt('Reason for archiving (optional):') ?? '') : undefined;
    try {
      const res = await api.put(`/admin/posts/${post._id}/archive`, { archive, reason });
      setPosts((ps) => ps.map((p) => p._id === post._id ? { ...p, isArchived: archive } : p));
      if (archive && res.data.undoToken) {
        setUndo({ token: res.data.undoToken, message: 'Post archived' });
      }
      toast.success(archive ? 'Post archived' : 'Post unarchived');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleHardDelete = async (post) => {
    if (!window.confirm(`Permanently delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/posts/${post._id}/hard`);
      setPosts((ps) => ps.filter((p) => p._id !== post._id));
      toast.success('Post permanently deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Posts <span className="font-normal text-base" style={{ color: 'var(--text-muted)' }}>({pagination.total})</span>
        </h2>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="rounded" />
          Show hidden
        </label>
      </div>

      {undo && (
        <UndoBanner
          token={undo.token}
          message={undo.message}
          onExpire={() => setUndo(null)}
          onUndo={() => { setUndo(null); fetchPosts(pagination.page); }}
        />
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="input pl-9"
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                {['Title', 'Author', 'Score', 'Comments', 'Posted', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold uppercase tracking-wide px-4 py-3" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
                      </td>
                    ))}
                  </tr>
                ))
                : posts.map((p) => (
                  <tr
                    key={p._id}
                    style={{ borderBottom: '1px solid var(--border)', opacity: p.isHidden || p.isArchived ? 0.6 : 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                  >
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.description?.slice(0, 80)}</p>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.author?.username}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{p.voteScore}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-muted)' }}>{p.commentCount || 0}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="badge text-[10px]"
                          style={p.isHidden
                            ? { backgroundColor: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }
                            : { backgroundColor: 'rgba(34,197,94,0.12)', color: 'rgb(34,197,94)' }}
                        >
                          {p.isHidden ? 'Hidden' : 'Visible'}
                        </span>
                        {p.isArchived && (
                          <span className="badge text-[10px]" style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: 'rgb(234,179,8)' }}>
                            Archived
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link to={`/forum/${p._id}`} target="_blank" className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-muted)' }}
                          title="View" onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}>
                          <ExternalLink size={14} />
                        </Link>
                        <button onClick={() => handleToggleHide(p)} className="p-1.5 rounded transition-colors"
                          style={{ color: p.isHidden ? 'rgb(34,197,94)' : 'rgb(239,68,68)' }}
                          title={p.isHidden ? 'Restore' : 'Hide'}>
                          {p.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => handleArchive(p)} className="p-1.5 rounded transition-colors"
                          style={{ color: p.isArchived ? 'rgb(99,102,241)' : 'rgb(234,179,8)' }}
                          title={p.isArchived ? 'Unarchive' : 'Archive'}>
                          <Archive size={14} />
                        </button>
                        <button onClick={() => handleHardDelete(p)} className="p-1.5 rounded transition-colors"
                          style={{ color: 'rgb(239,68,68)' }} title="Hard delete"
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 text-sm"
            style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button onClick={() => fetchPosts(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary py-1 px-3 text-xs">Prev</button>
              <button onClick={() => fetchPosts(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-secondary py-1 px-3 text-xs">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
