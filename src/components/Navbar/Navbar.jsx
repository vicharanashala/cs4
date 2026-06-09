import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogIn, LogOut, Shield, MessageSquare, HelpCircle, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LoginModal from '../Auth/LoginModal';
import NotificationBell from './NotificationBell';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [time, setTime]           = useState(new Date());
  const [showLogin, setShowLogin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeStr  = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr  = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/');
    setMobileOpen(false);
  };

  const navLinks = [
    { to: '/',      label: 'FAQ',    icon: HelpCircle },
    { to: '/forum', label: 'Forum',  icon: MessageSquare },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Shield }] : []),
  ];

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      <nav
        className="sticky top-0 z-40"
        style={{
          backgroundColor: isDark ? 'rgba(0,0,0,0.82)' : 'rgba(255,255,255,0.68)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          borderBottom: '1px solid var(--border)',
          boxShadow: isDark
            ? '0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.4)'
            : '0 1px 0 rgba(255,255,255,0.7), 0 4px 20px rgba(80,80,160,0.08)',
        }}
      >
        <div className="page-container">
          <div className="flex items-center h-16 gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <span className="text-white font-black text-base tracking-tight">V</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-black text-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>VINS</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-0.5 ml-2">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-150"
                  style={{
                    backgroundColor: isActive(to) ? 'var(--accent-light)' : 'transparent',
                    color:           isActive(to) ? 'var(--accent)'       : 'var(--text-secondary)',
                  }}
                  onMouseEnter={e => { if (!isActive(to)) { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                  onMouseLeave={e => { if (!isActive(to)) { e.currentTarget.style.backgroundColor = 'transparent';        e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex-1" />

            {/* ── Clock box ── */}
            <div
              className="hidden lg:flex items-center px-4 py-2 rounded-xl gap-3"
              style={{ background: 'var(--btn-secondary-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}
            >
              <div className="flex flex-col items-end">
                <span className="text-base font-bold tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  {timeStr}
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{dateStr}</span>
              </div>
              <div className="w-px self-stretch" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{timezone}</span>
            </div>

            {/* Theme toggle */}
            <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" aria-label="Toggle theme">
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* Notifications */}
            {user && <NotificationBell />}

            {/* Auth */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                  style={{ background: 'var(--btn-secondary-bg)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</span>
                  {isAdmin && (
                    <span className="badge text-white text-[10px]" style={{ backgroundColor: 'var(--accent)' }}>Admin</span>
                  )}
                </div>
                <button onClick={handleLogout} className="btn-ghost p-2 rounded-lg" title="Sign out">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLogin(true)} className="btn-primary hidden md:flex px-4 py-2">
                <LogIn size={14} />
                Sign in
              </button>
            )}

            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(v => !v)} className="btn-ghost p-2 rounded-lg md:hidden">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div
              className="md:hidden pb-3 pt-1 space-y-1 animate-slide-down"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    backgroundColor: isActive(to) ? 'var(--accent-light)' : 'transparent',
                    color:           isActive(to) ? 'var(--accent)'       : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
              <div className="px-4 py-2.5" style={{ borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{timeStr}</span>
                  <span>{timezone}</span>
                </div>
                {user ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</span>
                    <button onClick={handleLogout} className="btn-ghost text-sm flex items-center gap-1">
                      <LogOut size={13} /> Sign out
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setShowLogin(true); setMobileOpen(false); }} className="btn-primary w-full">
                    Sign in
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
