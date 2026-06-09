import { useState, useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown, Reply, Minus, Plus, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const MENTION_REGEX = /@([a-zA-Z0-9_]*)$/;
const MAX_DEPTH = 8;

function MentionHighlight({ content }) {
  const parts = content.split(/(@[a-zA-Z0-9_]{3,30})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^@[a-zA-Z0-9_]{3,30}$/.test(part) ? (
          <mark
            key={i}
            style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)', borderRadius: 3, padding: '0 2px' }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function MentionInput({ value, onChange, placeholder, rows = 3 }) {
  const [suggestions, setSuggestions]       = useState([]);
  const [selectedIndex, setSelectedIndex]   = useState(0);
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    setSelectedIndex(0);

    const match = val.slice(0, e.target.selectionStart).match(MENTION_REGEX);
    if (match) {
      const query = match[1];
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.get('/users/search', { params: { q: query } });
          setSuggestions(res.data.users || []);
        } catch { setSuggestions([]); }
      }, 200);
    } else {
      setSuggestions([]);
    }
  };

  const insertMention = (username) => {
    const cursor = textareaRef.current?.selectionStart || value.length;
    const before = value.slice(0, cursor);
    const after  = value.slice(cursor);
    const replaced = before.replace(MENTION_REGEX, `@${username} `);
    onChange(replaced + after);
    setSuggestions([]);
    setSelectedIndex(0);
    setTimeout(() => {
      const pos = replaced.length;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertMention(suggestions[selectedIndex].username);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        className="input text-sm w-full resize-none"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{ fontFamily: 'inherit' }}
      />
      {suggestions.length > 0 && (
        <div
          className="absolute rounded-xl shadow-xl overflow-hidden"
          style={{
            bottom: 'calc(100% + 6px)',
            left: 0,
            minWidth: 248,
            backgroundColor: 'var(--bg-secondary)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 200,
          }}
        >
          <div
            className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Members
          </div>
          {suggestions.map((u, i) => (
            <button
              key={u._id || u.username}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u.username); }}
              onMouseEnter={() => setSelectedIndex(i)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-all"
              style={{
                backgroundColor: i === selectedIndex ? 'var(--accent-light)' : 'transparent',
                borderLeft: i === selectedIndex ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                style={{ backgroundColor: u.role === 'admin' ? 'var(--accent)' : 'rgba(99,102,241,0.6)' }}
              >
                {u.username[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {u.username}
                  </span>
                  {u.role === 'admin' && (
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                    >
                      admin
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  #{u.publicId}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfanityWarningBanner({ onDismiss }) {
  return (
    <div style={{
      backgroundColor: 'rgba(239,68,68,0.07)',
      border: '2px solid rgba(239,68,68,0.45)',
      borderRadius: '12px',
      padding: '16px 18px',
      marginBottom: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <span style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>🚫</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '14px', fontWeight: 800, color: 'rgb(220,38,38)', marginBottom: '5px', letterSpacing: '-0.01em' }}>
            Policy Violation — Inappropriate Language Detected
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(220,38,38,0.88)', lineHeight: '1.65', marginBottom: '5px' }}>
            Your reply contains language that is prohibited under the{' '}
            <strong>VINS Community Forum Policy</strong>. Profanity and hostile language are not
            tolerated.{' '}
            <strong>This attempt has been recorded and will be reviewed by administrators.</strong>
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(220,38,38,0.65)', lineHeight: '1.5' }}>
            Please revise your reply before resubmitting. Repeated violations may result in a timeout or ban.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ color: 'rgb(220,38,38)', background: 'none', border: 'none', fontSize: '18px', lineHeight: 1, cursor: 'pointer', padding: '0 0 0 4px', opacity: 0.6, flexShrink: 0 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function SingleComment({ comment, postId, onReply, onLoginRequired, depth = 0, onDeleteComment }) {
  const { user } = useAuth();
  const isAdmin        = user?.role === 'admin';
  const isCommentOwner = !isAdmin && user && (user._id === comment.author?._id || user.username === comment.author?.username);
  const canDelete      = isAdmin || isCommentOwner;

  const [showReply, setShowReply]       = useState(false);
  const [replyText, setReplyText]       = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [localVote, setLocalVote]       = useState(comment.userVote || 0);
  const [localScore, setLocalScore]     = useState(comment.voteScore || 0);
  const [collapsed, setCollapsed]       = useState(false);
  const [profanityWarning, setProfanityWarning] = useState(false);

  const handleVote = async (value) => {
    if (!user) { onLoginRequired?.(); return; }
    const newValue = localVote === value ? 0 : value;
    const delta = newValue - localVote;
    setLocalVote(newValue);
    setLocalScore((s) => s + delta);
    try {
      const res = await api.post(`/forum/posts/${postId}/comments/${comment._id}/vote`, { value: newValue });
      setLocalScore(res.data.voteScore);
    } catch {
      setLocalVote(localVote);
      setLocalScore((s) => s - delta);
    }
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    setProfanityWarning(false);
    setSubmitting(true);
    try {
      const res = await api.post(`/forum/posts/${postId}/comments`, {
        content: replyText,
        parentId: comment._id,
      });
      onReply?.(comment._id, res.data.comment);
      setReplyText('');
      setShowReply(false);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === 'PROFANITY_DETECTED') {
        setProfanityWarning(true);
      } else if (errData?.code === 'TIMEOUT_ACTIVE') {
        toast.error(`You are in timeout for ${Math.ceil(errData.remainingSeconds / 60)} more minute(s)`);
      } else {
        toast.error(errData?.error || 'Failed to post reply');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this comment?')) return;
    setDeleting(true);
    try {
      await api.delete(`/forum/posts/${postId}/comments/${comment._id}`);
      onDeleteComment?.(comment._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
      setDeleting(false);
    }
  };

  const hasReplies  = comment.replies?.length > 0;
  const indentStyle = depth > 0
    ? { marginLeft: Math.min(depth * 16, 64), paddingLeft: 12, borderLeft: '2px solid var(--border)' }
    : {};

  return (
    <div style={indentStyle}>
      {/* Collapse toggle */}
      {hasReplies && depth === 0 && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 text-[10px] mb-1 px-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          {collapsed ? <Plus size={10} /> : <Minus size={10} />}
          {collapsed
            ? `Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}`
            : 'Collapse'}
        </button>
      )}

      <div className="py-2.5" style={{ opacity: deleting ? 0.4 : 1 }}>
        {/* Author + time */}
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: comment.author?.role === 'admin' ? 'var(--accent)' : 'rgba(99,102,241,0.6)' }}
          >
            {(comment.author?.username || '?')[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{comment.author?.username}</span>
          {comment.author?.role === 'admin' && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
            >
              admin
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap pl-8" style={{ color: 'var(--text-primary)' }}>
          <MentionHighlight content={comment.content} />
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2 pl-8">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleVote(1)}
              className="p-0.5 rounded transition-colors"
              style={{ color: localVote === 1 ? 'var(--accent)' : 'var(--text-muted)' }}
              onMouseEnter={(e) => { if (localVote !== 1) e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { if (localVote !== 1) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <ChevronUp size={14} />
            </button>
            <span
              className="text-xs font-medium tabular-nums"
              style={{ color: localScore > 0 ? 'var(--accent)' : localScore < 0 ? 'rgb(239,68,68)' : 'var(--text-muted)' }}
            >
              {localScore}
            </span>
            <button
              onClick={() => handleVote(-1)}
              className="p-0.5 rounded transition-colors"
              style={{ color: localVote === -1 ? 'rgb(239,68,68)' : 'var(--text-muted)' }}
              onMouseEnter={(e) => { if (localVote !== -1) e.currentTarget.style.color = 'rgb(239,68,68)'; }}
              onMouseLeave={(e) => { if (localVote !== -1) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {user && depth < MAX_DEPTH && (
            <button
              onClick={() => setShowReply((v) => !v)}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Reply size={12} />
              Reply
            </button>
          )}

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgb(239,68,68)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>

        {/* Reply box */}
        {showReply && (
          <div className="mt-3 pl-8 space-y-2">
            {profanityWarning && (
              <ProfanityWarningBanner onDismiss={() => setProfanityWarning(false)} />
            )}
            <MentionInput
              value={replyText}
              onChange={setReplyText}
              placeholder={`Reply to @${comment.author?.username}… (type @ to mention)`}
              rows={3}
            />
            <div className="flex gap-2">
              <button onClick={submitReply} disabled={!replyText.trim() || submitting} className="btn-primary text-xs py-1.5 px-3">
                {submitting ? '...' : 'Reply'}
              </button>
              <button onClick={() => { setShowReply(false); setReplyText(''); setProfanityWarning(false); }} className="btn-secondary text-xs py-1.5 px-3">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {!collapsed && hasReplies && (
        <div>
          {comment.replies.map((reply) => (
            <SingleComment
              key={reply._id}
              comment={reply}
              postId={postId}
              onReply={onReply}
              onLoginRequired={onLoginRequired}
              onDeleteComment={onDeleteComment}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentThread({ comments, postId, onReply, onLoginRequired, onDeleteComment }) {
  const handleReply = useCallback((parentId, newComment) => {
    onReply?.(parentId, newComment);
  }, [onReply]);

  if (!comments?.length) {
    return (
      <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
        No comments yet. Be the first to reply!
      </div>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
      {comments.map((comment) => (
        <SingleComment
          key={comment._id}
          comment={comment}
          postId={postId}
          onReply={handleReply}
          onLoginRequired={onLoginRequired}
          onDeleteComment={onDeleteComment}
        />
      ))}
    </div>
  );
}
