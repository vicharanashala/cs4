import { useState, useEffect } from 'react';
import { Users, FileText, MessageSquare, TrendingUp, AlertCircle, EyeOff, UserPlus, Activity } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';

const ICON_PALETTES = {
  accent:  { bg: 'var(--accent-light)',     fg: 'var(--accent)' },
  success: { bg: 'rgba(34,197,94,0.12)',    fg: 'rgb(34,197,94)' },
  danger:  { bg: 'rgba(239,68,68,0.12)',    fg: 'rgb(239,68,68)' },
  warn:    { bg: 'rgba(234,179,8,0.12)',    fg: 'rgb(234,179,8)' },
  purple:  { bg: 'rgba(168,85,247,0.12)',   fg: 'rgb(168,85,247)' },
};

const StatCard = ({ icon: Icon, label, value, sub, palette = 'accent' }) => {
  const { bg, fg } = ICON_PALETTES[palette] ?? ICON_PALETTES.accent;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg, color: fg }}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value?.toLocaleString() ?? '—'}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
};

export default function Statistics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="card h-28 animate-pulse bg-[var(--bg-tertiary)]" />
        ))}
      </div>
    );
  }

  const { stats, topUsers, postsOverTime, recentActivity } = data || {};

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}        label="Total Users"   value={stats?.totalUsers}    sub={`+${stats?.dailyRegistrations} today`} palette="accent" />
        <StatCard icon={FileText}     label="Total Posts"   value={stats?.totalPosts}    sub={`+${stats?.dailyPosts} today`}          palette="success" />
        <StatCard icon={MessageSquare} label="Comments"     value={stats?.totalComments}                                              palette="purple" />
        <StatCard icon={TrendingUp}   label="Votes Cast"    value={stats?.totalVotes}                                                 palette="warn" />
        <StatCard icon={AlertCircle}  label="Banned Users"  value={stats?.bannedUsers}                                                palette="danger" />
        <StatCard icon={EyeOff}       label="Hidden Posts"  value={stats?.hiddenPosts}                                                palette="danger" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Posts over time */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Posts (last 7 days)</h3>
          {postsOverTime?.length > 0 ? (
            <div className="space-y-2">
              {postsOverTime.map(({ _id, count }) => (
                <div key={_id} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] w-20 flex-shrink-0">{_id}</span>
                  <div className="flex-1 h-5 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                    <div
                      className="h-full bg-[var(--accent)] rounded transition-all"
                      style={{ width: `${Math.min(100, (count / (Math.max(...postsOverTime.map(p => p.count)) || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-secondary)] w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No data</p>
          )}
        </div>

        {/* Top users */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Top Contributors</h3>
          <div className="space-y-2.5">
            {topUsers?.map((u, i) => (
              <div key={u._id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--text-muted)] w-4">{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(u.username || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{u.username}</p>
                  <p className="text-xs text-[var(--text-muted)]">{u.postCount} posts · {u.commentCount} comments</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">Recent Activity</h3>
        <div className="space-y-2">
          {recentActivity?.map((log) => (
            <div key={log._id} className="flex items-start gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <div
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor: log.level === 'error' ? 'rgb(239,68,68)' : log.level === 'warn' ? 'rgb(234,179,8)' : 'rgb(34,197,94)',
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)]">
                  <span className="font-medium">{log.action}</span>
                  {log.username && <span className="text-[var(--text-muted)]"> by {log.username}</span>}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{log.ip}</p>
              </div>
              <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                {format(new Date(log.createdAt), 'HH:mm:ss')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
