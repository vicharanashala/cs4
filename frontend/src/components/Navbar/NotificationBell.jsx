import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, Reply, AtSign, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';

const TYPE_ICON = {
  reply: Reply,
  mention: AtSign,
  admin_message: Shield,
};

const TYPE_COLOR = {
  reply: 'var(--accent)',
  mention: 'rgb(168,85,247)',
  admin_message: 'rgb(234,179,8)',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { socket } = useSocket();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // silently ignore
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!socket) return;
    const handler = (notif) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 29)]);
      setUnreadCount((n) => n + 1);
    };
    socket.on('notification', handler);
    return () => socket.off('notification', handler);
  }, [socket]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleClick = async (notif) => {
    if (!notif.read) {
      try { await api.put(`/notifications/${notif._id}/read`); } catch {}
      setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (notif.post?._id) navigate(`/forum/${notif.post._id}`);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ backgroundColor: 'rgb(239,68,68)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-light)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; }}
                >
                  <Check size={11} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICON[notif.type] || Bell;
                const color = TYPE_COLOR[notif.type] || 'var(--accent)';
                return (
                  <button
                    key={notif._id}
                    onClick={() => handleClick(notif)}
                    className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors"
                    style={{
                      backgroundColor: notif.read ? 'transparent' : 'rgba(99,102,241,0.05)',
                      borderBottom: '1px solid var(--border)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = notif.read ? 'transparent' : 'rgba(99,102,241,0.05)'; }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                        {notif.type === 'reply' && (
                          <><span className="font-semibold">{notif.actor?.username}</span> replied to your comment</>
                        )}
                        {notif.type === 'mention' && (
                          <><span className="font-semibold">{notif.actor?.username}</span> mentioned you</>
                        )}
                        {notif.type === 'admin_message' && (
                          <span style={{ color: 'rgb(234,179,8)' }}>{notif.message}</span>
                        )}
                      </p>
                      {notif.post?.title && (
                        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                          {notif.post.title}
                        </p>
                      )}
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: 'var(--accent)' }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
