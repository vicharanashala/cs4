import { useState } from 'react';
import { X, Eye, EyeOff, Monitor, Smartphone, AlertTriangle, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

function isMobileDevice(brand, model) {
  const mobileKeywords = ['iphone', 'ipad', 'android', 'samsung', 'pixel', 'galaxy', 'xiaomi', 'huawei', 'oppo', 'vivo'];
  const combined = `${brand} ${model}`.toLowerCase();
  return mobileKeywords.some((k) => combined.includes(k));
}

function DeviceIcon({ brand, model, size = 32, color }) {
  const Icon = isMobileDevice(brand, model) ? Smartphone : Monitor;
  return <Icon size={size} style={{ color }} />;
}

function ConflictPanel({ conflict, onForceLogin, onCancel, loading }) {
  const { deviceBrand, deviceModel, deviceOs, ip, lastSeen } = conflict;
  const timeAgo = lastSeen ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true }) : 'unknown time';

  return (
    <div style={{ animation: 'slideDown 200ms cubic-bezier(0.34,1.56,0.64,1) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(239,68,68,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={22} style={{ color: 'rgb(239,68,68)' }} />
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'rgb(239,68,68)', margin: 0, letterSpacing: '-0.01em' }}>
            Account Already Active
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            Your account is signed in on another device
          </p>
        </div>
      </div>

      {/* Device card */}
      <div style={{
        borderRadius: 14,
        border: '2px solid rgba(239,68,68,0.35)',
        backgroundColor: 'rgba(239,68,68,0.07)',
        padding: '18px 20px',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: 'rgba(239,68,68,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <DeviceIcon brand={deviceBrand} model={deviceModel} size={26} color="rgb(239,68,68)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {deviceBrand} {deviceModel}
              {deviceOs && (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {deviceOs}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              IP: {ip || 'Unknown'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Last active {timeAgo}
            </div>
          </div>
        </div>
      </div>

      {/* Warning text */}
      <p style={{
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.55,
        marginBottom: 22,
        padding: '10px 14px',
        borderRadius: 8,
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid rgba(239,68,68,0.15)',
      }}>
        Signing in here will <strong style={{ color: 'var(--text-primary)' }}>immediately log out</strong> the device shown above.
        Only one device can be active at a time.
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={onForceLogin}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px 20px',
            borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? 'rgba(239,68,68,0.5)' : 'rgb(239,68,68)',
            color: '#fff', fontSize: 14, fontWeight: 700,
            fontFamily: 'Montserrat, sans-serif',
            transition: 'opacity 150ms ease',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
            : <LogIn size={16} />}
          {loading ? 'Signing in…' : 'Sign in here — log out other device'}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            width: '100%', padding: '11px 20px',
            borderRadius: 10, border: '1px solid var(--border)',
            cursor: 'pointer', background: 'var(--bg-card)',
            color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
            fontFamily: 'Montserrat, sans-serif',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function LoginModal({ isOpen, onClose }) {
  const { login, forceLogin } = useAuth();
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm]                 = useState({ email: '', password: '' });
  const [error, setError]               = useState('');
  const [conflict, setConflict]         = useState(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setConflict(null);
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      handleClose();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.error === 'device_conflict') {
        setConflict(err.response.data.conflict);
      } else {
        setError(err.response?.data?.error || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    setLoading(true);
    try {
      await forceLogin(form.email, form.password);
      toast.success('Signed in. Other device has been logged out.');
      handleClose();
    } catch (err) {
      setConflict(null);
      setError(err.response?.data?.error || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
        <div
          className="relative card p-8 w-full max-w-md"
          style={{
            animation: 'slideDown 200ms cubic-bezier(0.34,1.56,0.64,1) both',
            border: conflict ? '1px solid rgba(239,68,68,0.4)' : undefined,
          }}
        >
          <button onClick={handleClose} className="absolute top-4 right-4 btn-ghost p-1.5 rounded-lg">
            <X size={18} />
          </button>

          {conflict ? (
            <ConflictPanel
              conflict={conflict}
              onForceLogin={handleForceLogin}
              onCancel={() => setConflict(null)}
              loading={loading}
            />
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[var(--text-primary)]">Welcome back</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">Sign in to join the community</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={set('email')}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-10"
                      placeholder="Your password"
                      value={form.password}
                      onChange={set('password')}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(239,68,68)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={loading}>
                  {loading
                    ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : 'Sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
