import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronUp, ChevronDown, MessageSquare, Clock,
  MoreHorizontal, Pin, Archive, Eye, EyeOff, Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function UndoToast({ t, label, onUndo }) {
  const [sec, setSec] = useState(10);
  useEffect(() => {
    if (sec <= 0) return;
    const id = setTimeout(() => setSec(s => s - 1), 1000);
    return () => clearTimeout(id);
  }, [sec]);
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
      style={{
        backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)',
        minWidth: 220,
      }}
    >
      <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
      <button
        className="text-sm font-bold"
        style={{ color: 'var(--accent)' }}
        onClick={() => { toast.dismiss(t.id); onUndo(); }}
      >
        Undo
      </button>
      <span className="text-xs tabular-nums w-6 text-right" style={{ color: 'var(--text-muted)' }}>{sec}s</span>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left"
      style={{ color: danger ? 'rgb(239,68,68)' : 'var(--text-primary)' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

export default function PostCard({ post, onVoteUpdate, onLoginRequired, onUpdate, onDelete }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isOwner = !isAdmin && user && post.author && user._id === post.author._id;
  const showMenu = isAdmin || isOwner;

  const [voting, setVoting]           = useState(false);
  const [localVote, setLocalVote]     = useState(post.userVote || 0);
  const [localScore, setLocalScore]   = useState(post.voteScore || 0);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const menuBtnRef  = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onMouse  = (e) => {
      const inBtn  = menuBtnRef.current  && menuBtnRef.current.contains(e.target);
      const inDrop = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inBtn && !inDrop) setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    document.addEventListener('mousedown', onMouse);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuOpen]);

  const openMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!menuOpen && menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setMenuOpen(v => !v);
  };

  const handleVote = async (value) => {
    if (!user) { onLoginRequired?.(); return; }
    if (voting) return;
    const newValue   = localVote === value ? 0 : value;
    const scoreDelta = newValue - localVote;
    const prevVote   = localVote;
    setLocalVote(newValue);
    setLocalScore(s => s + scoreDelta);
    setVoting(true);
    try {
      const res = await api.post(`/forum/posts/${post._id}/vote`, { value: newValue });
      setLocalScore(res.data.voteScore);
      onVoteUpdate?.(post._id, res.data.voteScore, newValue);
    } catch (err) {
      setLocalVote(prevVote);
      setLocalScore(s => s - scoreDelta);
      toast.error(err.response?.data?.error || 'Vote failed');
    } finally {
      setVoting(false);
    }
  };

  const fireUndoToast = (label, undoFn) => {
    toast.custom((t) => <UndoToast t={t} label={label} onUndo={undoFn} />, { duration: 10000 });
  };

  const handlePin = async () => {
    setMenuOpen(false);
    try {
      const res = await api.put(`/admin/posts/${post._id}/pin`);
      onUpdate?.(post._id, { isPinned: res.data.isPinned });
      toast.success(res.data.isPinned ? 'Post pinned' : 'Post unpinned');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleHide = async () => {
    setMenuOpen(false);
    const willHide = !post.isHidden;
    try {
      await api.put(`/admin/posts/${post._id}/hide`);
      onUpdate?.(post._id, { isHidden: willHide });
      if (willHide) {
        fireUndoToast('Post hidden from members', async () => {
          await api.put(`/admin/posts/${post._id}/hide`);
          onUpdate?.(post._id, { isHidden: false });
        });
      } else {
        toast.success('Post is now visible');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleArchive = async () => {
    setMenuOpen(false);
    const willArchive = !post.isArchived;
    try {
      await api.put(`/admin/posts/${post._id}/archive`);
      onUpdate?.(post._id, { isArchived: willArchive });
      if (willArchive) {
        fireUndoToast('Post archived', async () => {
          await api.put(`/admin/posts/${post._id}/archive`);
          onUpdate?.(post._id, { isArchived: false });
        });
      } else {
        toast.success('Post unarchived');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleHardDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('Permanently delete this post and all its comments? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/posts/${post._id}/hard`);
      onDelete?.(post._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleOwnerDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('Delete your post? This cannot be undone.')) return;
    try {
      await api.delete(`/forum/posts/${post._id}`);
      onDelete?.(post._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const borderColor = localScore > 0 ? 'var(--accent)' : localScore < 0 ? 'rgb(239,68,68)' : 'var(--border)';
  const scoreColor  = localScore > 0 ? 'var(--accent)' : localScore < 0 ? 'rgb(239,68,68)' : 'var(--text-muted)';

  return (
    <div
      className="card hover:shadow-[var(--shadow-md)] transition-all duration-150 flex"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      {/* Vote column */}
      <div
        className="flex flex-col items-center gap-0.5 px-2.5 py-3 flex-shrink-0"
        style={{
          backgroundColor: 'var(--bg-tertiary)',
          borderRight: '1px solid var(--border)',
          borderRadius: '13px 0 0 13px',
        }}
      >
        <button
          onClick={() => handleVote(1)}
          className="vote-btn p-1.5 rounded transition-all"
          style={{
            color: localVote === 1 ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: localVote === 1 ? 'var(--accent-light)' : 'transparent',
          }}
        >
          <ChevronUp size={18} />
        </button>
        <span className="text-sm font-black tabular-nums" style={{ color: scoreColor, minWidth: '1.5rem', textAlign: 'center' }}>
          {localScore}
        </span>
        <button
          onClick={() => handleVote(-1)}
          className="vote-btn p-1.5 rounded transition-all"
          style={{
            color: localVote === -1 ? 'rgb(239,68,68)' : 'var(--text-muted)',
            backgroundColor: localVote === -1 ? 'rgba(239,68,68,0.1)' : 'transparent',
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 min-w-0 relative">
        {/* Pin indicator */}
        {post.isPinned && (
          <div className="flex items-center gap-1 mb-2">
            <Pin size={11} style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Pinned</span>
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {post.tags.map(tag =>
              tag === 'Ignored Similar Post'
                ? <span key={tag} className="tag text-[11px] py-0.5" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', borderColor: 'rgba(239,68,68,0.3)' }}>{tag}</span>
                : <span key={tag} className="tag text-[11px] py-0.5">{tag}</span>
            )}
          </div>
        )}

        {/* Three-dot menu — dropdown rendered via portal to escape backdrop-filter stacking context */}
        {showMenu && (
          <div className="absolute top-3 right-3">
            <button
              ref={menuBtnRef}
              onClick={openMenu}
              className="p-1.5 rounded-lg transition-colors"
              style={{
                color: menuOpen ? 'var(--accent)' : 'var(--text-muted)',
                backgroundColor: menuOpen ? 'var(--accent-light)' : 'transparent',
              }}
              onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; } }}
              onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        )}

        {/* Title + description */}
        <Link to={`/forum/${post._id}`} className="block group pr-8">
          <h3
            className="font-bold leading-snug mb-1.5"
            style={{ fontSize: '15px', color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            {post.title}
          </h3>
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
            {post.description}
          </p>
        </Link>

        {/* Meta */}
        <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {(post.author?.username || '?')[0].toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>{post.author?.username}</span>
            {post.author?.role === 'admin' && (
              <span className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', fontSize: '10px' }}>admin</span>
            )}
          </span>

          <span className="flex items-center gap-1">
            <Clock size={11} />
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>

          <Link
            to={`/forum/${post._id}`}
            className="flex items-center gap-1 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <MessageSquare size={11} />
            {post.commentCount || 0}
          </Link>
        </div>
      </div>

      {/* Portal dropdown — lives at document.body, escapes all stacking contexts */}
      {showMenu && menuOpen && createPortal(
        <div
          ref={dropdownRef}
          className="rounded-lg overflow-hidden py-1"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            right: dropdownPos.right,
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 170,
            zIndex: 9999,
          }}
        >
          {isAdmin && (
            <>
              <MenuItem icon={Pin}     label={post.isPinned   ? 'Unpin post'  : 'Pin post'}   onClick={handlePin} />
              <MenuItem icon={post.isHidden ? Eye : EyeOff} label={post.isHidden ? 'Show post' : 'Hide post'} onClick={handleHide} />
              <MenuItem icon={Archive} label={post.isArchived ? 'Unarchive'   : 'Archive'}     onClick={handleArchive} />
              <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '2px 0' }} />
              <MenuItem icon={Trash2}  label="Delete permanently" onClick={handleHardDelete} danger />
            </>
          )}
          {!isAdmin && isOwner && (
            <MenuItem icon={Trash2} label="Delete post" onClick={handleOwnerDelete} danger />
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
