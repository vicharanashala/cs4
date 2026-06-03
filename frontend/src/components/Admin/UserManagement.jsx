import { useState, useEffect } from 'react';
import { Search, UserPlus, Shield, Ban, Trash2, Edit, X, Eye } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?page=${page}&limit=20&search=${search}`);
      setUsers(res.data.users);
      setPagination(res.data.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(1), search ? 400 : 0);
    return () => clearTimeout(t);
  }, [search]);

  const handleBan = async (user) => {
    const action = user.isBanned ? 'unban' : 'ban';
    const reason = user.isBanned ? undefined : prompt('Reason for ban:');
    if (!user.isBanned && !reason) return;
    try {
      await api.put(`/admin/users/${user._id}`, { isBanned: !user.isBanned, banReason: reason });
      setUsers((us) => us.map((u) => u._id === user._id ? { ...u, isBanned: !u.isBanned } : u));
      toast.success(`User ${action}ned`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const handleRoleToggle = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${user.username}'s role to ${newRole}?`)) return;
    try {
      await api.put(`/admin/users/${user._id}`, { role: newRole });
      setUsers((us) => us.map((u) => u._id === user._id ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (user) => {
    if (!confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${user._id}`);
      setUsers((us) => us.filter((u) => u._id !== user._id));
      toast.success('User deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/admin/users', newUser);
      setUsers((u) => [res.data.user, ...u]);
      setShowCreate(false);
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      toast.success('User created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          Users <span className="text-[var(--text-muted)] font-normal text-base">({pagination.total})</span>
        </h2>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <UserPlus size={16} />
          Add user
        </button>
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <form onSubmit={handleCreate} className="relative card p-6 w-full max-w-md animate-slide-down space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-[var(--text-primary)]">Create User</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
            </div>
            {[
              { label: 'Username', field: 'username', type: 'text' },
              { label: 'Email', field: 'email', type: 'email' },
              { label: 'Password', field: 'password', type: 'password' },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{label}</label>
                <input
                  type={type}
                  className="input"
                  value={newUser[field]}
                  onChange={(e) => setNewUser((u) => ({ ...u, [field]: e.target.value }))}
                  required
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Role</label>
              <select
                className="input"
                value={newUser.role}
                onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value }))}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary flex-1">{creating ? '...' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Search by username, email, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                {['User', 'Email', 'Role', 'Posts', 'Joined', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {loading
                ? [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-[var(--bg-secondary)] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : users.map((u) => (
                  <tr key={u._id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                          {(u.username || '?')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${u.role === 'admin' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">{u.postCount || 0}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)]">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="badge"
                        style={u.isBanned
                          ? { backgroundColor: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }
                          : { backgroundColor: 'rgba(34,197,94,0.12)',  color: 'rgb(34,197,94)' }}
                      >
                        {u.isBanned ? 'Banned' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRoleToggle(u)}
                          className="btn-ghost p-1.5 rounded"
                          title={u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        >
                          <Shield size={14} />
                        </button>
                        <button
                          onClick={() => handleBan(u)}
                          className="btn-ghost p-1.5 rounded"
                          style={{ color: u.isBanned ? 'rgb(34,197,94)' : 'rgb(239,68,68)' }}
                          title={u.isBanned ? 'Unban' : 'Ban'}
                        >
                          <Ban size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(u)}
                          className="btn-ghost p-1.5 rounded"
                          style={{ color: 'rgb(239,68,68)' }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)] text-sm">
            <span className="text-[var(--text-muted)]">Page {pagination.page} of {pagination.pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary py-1 px-3 text-xs"
              >Prev</button>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="btn-secondary py-1 px-3 text-xs"
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
