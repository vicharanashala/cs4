import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import {
  ChevronUp, ChevronDown, ArrowLeft, Clock, MessageSquare, AlertTriangle,
  MoreHorizontal, Pin, Archive, Eye, EyeOff, Trash2,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import CommentThread, { MentionInput } from './CommentThread';
import LoginModal from '../Auth/LoginModal';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

function removeCommentFromTree(comments, commentId) {
  return comments
    .filter(c => c._id !== commentId)
    .map(c => ({ ...c, replies: c.replies ? removeCommentFromTree(c.replies, commentId) : [] }));
}

function findInTree(comments, commentId) {
  for (const c of comments) {
    if (c._id === commentId) return true;
    if (c.replies?.length && findInTree(c.replies, commentId)) return true;
  }
  return false;
}

function addReplyToTree(comments, parentId, newComment) {
  return comments.map((c) => {
    if (c._id === parentId) return { ...c, replies: [...(c.replies || []), newComment] };
    if (c.replies?.length) return { ...c, replies: addReplyToTree(c.replies, parentId, newComment) };
    return c;
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProfanityWarningBanner({ contentType = 'comment', onDismiss }) {
  return (
    <div style={{
      backgroundColor: 'rgba(239,68,68,0.07)',
      border: '2px solid rgba(239,68,68,0.45)',
      borderRadius: '12px',
      padding: '18px 20px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <span style={{ fontSize: '26px', lineHeight: 1, flexShrink: 0 }}>🚫</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: 'rgb(220,38,38)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
            Policy Violation — Inappropriate Language Detected
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(220,38,38,0.88)', lineHeight: '1.65', marginBottom: '6px' }}>
            Your {contentType} contains language that is prohibited under the{' '}
            <strong>VINS Community Forum Policy</strong>. Profanity and hostile language are not
            tolerated on this platform.{' '}
            <strong>This attempt has been recorded and will be reviewed by administrators.</strong>
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(220,38,38,0.65)', lineHeight: '1.5' }}>
            Please revise your {contentType} to comply with our Community Guidelines before resubmitting.
            Repeated violations may result in a timeout or permanent ban.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ color: 'rgb(220,38,38)', background: 'none', border: 'none', fontSize: '20px', lineHeight: 1, cursor: 'pointer', padding: '0 0 0 4px', opacity: 0.6, flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function TimeoutBanner({ user }) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!user?.timeoutUntil) return;
    const until = new Date(user.timeoutUntil);
    const update = () => {
      const s = Math.ceil((until - Date.now()) / 1000);
      setRemaining(s > 0 ? s : null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [user?.timeoutUntil]);

  if (!remaining) return null;
  const mins = Math.ceil(remaining / 60);
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5"
      style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}
    >
      <AlertTriangle size={16} style={{ color: 'rgb(234,179,8)', flexShrink: 0 }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: 'rgb(234,179,8)' }}>You are currently in timeout</p>
        <p className="text-xs" style={{ color: 'rgb(234,179,8)', opacity: 0.85 }}>
          {mins} minute{mins !== 1 ? 's' : ''} remaining · You cannot post or vote until your timeout expires.
        </p>
      </div>
    </div>
  );
}

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

// ── main component ────────────────────────────────────────────────────────────

export default function PostDetail() {
  const { postId }  = useParams();
  const { user }    = useAuth();
  const { socket }  = useSocket();
  const navigate    = useNavigate();
  const userRef     = useRef(user); // always-current user for socket closures
  useEffect(() => { userRef.current = user; }, [user]);

  const [post, setPost]           = useState(null);
  const [comments, setComments]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting]     = useState(false);
  const [localVote, setLocalVote] = useState(0);
  const [localScore, setLocalScore] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const [error, setError]         = useState('');
  const [commentProfanityWarning, setCommentProfanityWarning] = useState(false);
  const menuRef = useRef(null);

  const isAdmin  = user?.role === 'admin';
  const isOwner  = !isAdmin && user && post?.author && (user._id === post.author._id || user.username === post.author.username);
  const showMenu = post && (isAdmin || isOwner);

  useEffect(() => {
    const load = async () => {
      try {
        const [postRes, commentsRes] = await Promise.all([
          api.get(`/forum/posts/${postId}`),
          api.get(`/forum/posts/${postId}/comments`),
        ]);
        setPost(postRes.data.post);
        setLocalVote(postRes.data.post.userVote || 0);
        setLocalScore(postRes.data.post.voteScore || 0);
        setComments(commentsRes.data.comments);
      } catch {
        setError('Post not found');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [postId]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Real-time comment updates via Socket.io ──────────────────────────────
  useEffect(() => {
    if (!socket || !postId) return;
    socket.emit('join:post', postId);
    return () => socket.emit('leave:post', postId);
  }, [socket, postId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewComment = ({ comment }) => {
      const me = userRef.current;
      // Skip own comments — already added optimistically when submitted
      if (me && comment.author &&
          (String(comment.author._id) === String(me._id) || comment.author.username === me.username)) {
        return;
      }
      setComments((prev) => {
        if (findInTree(prev, comment._id)) return prev;
        if (comment.parent) return addReplyToTree(prev, comment.parent, comment);
        return [...prev, comment];
      });
      setPost((p) => p ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p);
    };

    const handleDeletedComment = ({ commentId }) => {
      setComments((prev) => {
        if (!findInTree(prev, commentId)) return prev;
        return removeCommentFromTree(prev, commentId);
      });
      setPost((p) => p ? { ...p, commentCount: Math.max((p.commentCount || 1) - 1, 0) } : p);
    };

    socket.on('post:comment_new',     handleNewComment);
    socket.on('post:comment_deleted', handleDeletedComment);
    return () => {
      socket.off('post:comment_new',     handleNewComment);
      socket.off('post:comment_deleted', handleDeletedComment);
    };
  }, [socket]);

  const handleVote = async (value) => {
    if (!user) { setShowLogin(true); return; }
    const newValue = localVote === value ? 0 : value;
    const delta = newValue - localVote;
    setLocalVote(newValue);
    setLocalScore((s) => s + delta);
    try {
      const res = await api.post(`/forum/posts/${postId}/vote`, { value: newValue });
      setLocalScore(res.data.voteScore);
    } catch (err) {
      setLocalVote(localVote);
      setLocalScore((s) => s - delta);
      const errData = err.response?.data;
      if (errData?.code === 'TIMEOUT_ACTIVE') {
        toast.error('You are in timeout and cannot vote');
      }
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || posting) return;
    setCommentProfanityWarning(false);
    setPosting(true);
    try {
      const res = await api.post(`/forum/posts/${postId}/comments`, { content: commentText });
      setComments((c) => [...c, res.data.comment]);
      setCommentText('');
      if (post) setPost((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === 'PROFANITY_DETECTED') {
        setCommentProfanityWarning(true);
      } else if (errData?.code === 'TIMEOUT_ACTIVE') {
        toast.error(`You are in timeout for ${Math.ceil(errData.remainingSeconds / 60)} more minute(s)`);
      } else {
        toast.error(errData?.error || 'Failed to post comment');
      }
    } finally {
      setPosting(false);
    }
  };

  const handleReply = useCallback((parentId, newComment) => {
    setComments((prev) => addReplyToTree(prev, parentId, newComment));
    if (post) setPost((p) => ({ ...p, commentCount: (p.commentCount || 0) + 1 }));
  }, [post]);

  const handleDeleteComment = useCallback((commentId) => {
    setComments((prev) => removeCommentFromTree(prev, commentId));
    setPost((p) => p ? { ...p, commentCount: Math.max((p.commentCount || 1) - 1, 0) } : p);
  }, []);

  // ── three-dot admin/owner actions ──

  const fireUndoToast = (label, undoFn) => {
    toast.custom((t) => <UndoToast t={t} label={label} onUndo={undoFn} />, { duration: 10000 });
  };

  const handlePin = async () => {
    setMenuOpen(false);
    try {
      const res = await api.put(`/admin/posts/${postId}/pin`);
      setPost(p => ({ ...p, isPinned: res.data.isPinned }));
      toast.success(res.data.isPinned ? 'Post pinned' : 'Post unpinned');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleHide = async () => {
    setMenuOpen(false);
    const willHide = !post.isHidden;
    try {
      await api.put(`/admin/posts/${postId}/hide`);
      setPost(p => ({ ...p, isHidden: willHide }));
      if (willHide) {
        fireUndoToast('Post hidden from members', async () => {
          await api.put(`/admin/posts/${postId}/hide`);
          setPost(p => ({ ...p, isHidden: false }));
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
      await api.put(`/admin/posts/${postId}/archive`);
      setPost(p => ({ ...p, isArchived: willArchive }));
      if (willArchive) {
        fireUndoToast('Post archived', async () => {
          await api.put(`/admin/posts/${postId}/archive`);
          setPost(p => ({ ...p, isArchived: false }));
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
      await api.delete(`/admin/posts/${postId}/hard`);
      navigate('/forum');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleOwnerDelete = async () => {
    setMenuOpen(false);
    if (!window.confirm('Delete your post? This cannot be undone.')) return;
    try {
      await api.delete(`/forum/posts/${postId}`);
      navigate('/forum');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete post');
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="page-container py-8">
        <div className="space-y-4">
          <div className="h-8 w-48 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
          <div className="card h-48 animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="page-container py-8 text-center">
        <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{error || 'Post not found'}</p>
        <Link to="/forum" className="btn-primary inline-flex">Back to Forum</Link>
      </div>
    );
  }

  return (
    <div className="page-container py-8">
      <Link
        to="/forum"
        className="inline-flex items-center gap-1.5 text-sm mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <ArrowLeft size={15} />
        Back to Forum
      </Link>

      {user && <TimeoutBanner user={user} />}

      {/* Post card */}
      <div className="card flex overflow-hidden mb-6">
        {/* Vote sidebar */}
        <div
          className="flex flex-col items-center gap-2 px-4 py-5"
          style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
        >
          <button
            onClick={() => handleVote(1)}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: localVote === 1 ? 'var(--accent)' : 'var(--text-muted)',
              backgroundColor: localVote === 1 ? 'var(--accent-light)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (localVote !== 1) { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.backgroundColor = 'var(--accent-light)'; } }}
            onMouseLeave={(e) => { if (localVote !== 1) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
          >
            <ChevronUp size={24} />
          </button>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: localScore > 0 ? 'var(--accent)' : localScore < 0 ? 'rgb(239,68,68)' : 'var(--text-muted)' }}
          >
            {localScore}
          </span>
          <button
            onClick={() => handleVote(-1)}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: localVote === -1 ? 'rgb(239,68,68)' : 'var(--text-muted)',
              backgroundColor: localVote === -1 ? 'rgba(239,68,68,0.1)' : 'transparent',
            }}
            onMouseEnter={(e) => { if (localVote !== -1) { e.currentTarget.style.color = 'rgb(239,68,68)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'; } }}
            onMouseLeave={(e) => { if (localVote !== -1) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
          >
            <ChevronDown size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 relative">
          {/* Three-dot menu */}
          {showMenu && (
            <div ref={menuRef} className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  color: menuOpen ? 'var(--accent)' : 'var(--text-muted)',
                  backgroundColor: menuOpen ? 'var(--accent-light)' : 'transparent',
                }}
                onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; } }}
                onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
              >
                <MoreHorizontal size={16} />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden py-1"
                  style={{
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: 180,
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
                </div>
              )}
            </div>
          )}

          {/* Pin indicator */}
          {post.isPinned && (
            <div className="flex items-center gap-1.5 mb-3">
              <Pin size={12} style={{ color: 'var(--accent)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>Pinned</span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-3 pr-8">
            {post.tags?.map((tag) => <span key={tag} className="tag">{tag}</span>)}
          </div>

          <h1 className="text-2xl font-bold leading-tight mb-3 pr-8" style={{ color: 'var(--text-primary)' }}>{post.title}</h1>

          <div className="flex items-center gap-4 text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {(post.author?.username || '?')[0].toUpperCase()}
              </div>
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{post.author?.username}</span>
              {post.author?.role === 'admin' && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                  style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  admin
                </span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={13} />
              {format(new Date(post.createdAt), 'MMM d, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare size={13} />
              {post.commentCount || 0} comment{post.commentCount !== 1 ? 's' : ''}
            </span>
          </div>

          <p className="leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{post.description}</p>

          {post.imageUrl && (
            <div className="mt-5">
              <img
                src={post.imageUrl}
                alt="Post attachment"
                className="rounded-lg max-w-full max-h-96 object-contain"
                style={{ border: '1px solid var(--border)' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Comment box */}
      <div className="card p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          {post.commentCount || 0} Comment{post.commentCount !== 1 ? 's' : ''}
        </h3>

        {user ? (
          <div className="space-y-3">
            {commentProfanityWarning && (
              <ProfanityWarningBanner
                contentType="comment"
                onDismiss={() => setCommentProfanityWarning(false)}
              />
            )}
            <MentionInput
              value={commentText}
              onChange={setCommentText}
              placeholder="Share your thoughts… (type @ to mention someone)"
              rows={3}
            />
            <div className="flex justify-end">
              <button onClick={submitComment} disabled={!commentText.trim() || posting} className="btn-primary">
                {posting ? '...' : 'Post comment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Sign in to join the discussion</p>
            <button onClick={() => setShowLogin(true)} className="btn-primary">Sign in</button>
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="card p-5">
        <CommentThread
          comments={comments}
          postId={postId}
          onReply={handleReply}
          onLoginRequired={() => setShowLogin(true)}
          onDeleteComment={handleDeleteComment}
        />
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
