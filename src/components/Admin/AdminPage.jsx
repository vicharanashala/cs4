import { useState } from 'react';
import { Users, FileText, BarChart2, Activity, Shield, BookOpen, Search, Heart } from 'lucide-react';
import UserManagement from './UserManagement';
import PostModeration from './PostModeration';
import Statistics from './Statistics';
import LogViewer from './LogViewer';
import FAQManagement from './FAQManagement';
import SearchGapTracker from './SearchGapTracker';
import SentimentPulse from './SentimentPulse';

const TABS = [
  { id: 'stats',     label: 'Dashboard',      icon: BarChart2 },
  { id: 'users',     label: 'Users',           icon: Users },
  { id: 'posts',     label: 'Moderation',      icon: FileText },
  { id: 'faq',       label: 'FAQ',             icon: BookOpen },
  { id: 'logs',      label: 'Logs',            icon: Activity },
  { id: 'searchgaps', label: 'Search Gaps',    icon: Search },
  { id: 'sentiment', label: 'Sentiment Pulse', icon: Heart },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('stats');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Admin header */}
      <div className="border-b" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="page-container py-5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>VINS Community Administration</p>
          </div>
        </div>
      </div>

      <div className="page-container py-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0">
            <nav className="card p-2 sticky top-24">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    activeTab === id
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'stats'      && <Statistics />}
            {activeTab === 'users'      && <UserManagement />}
            {activeTab === 'posts'      && <PostModeration />}
            {activeTab === 'faq'        && <FAQManagement />}
            {activeTab === 'logs'       && <LogViewer />}
            {activeTab === 'searchgaps' && <SearchGapTracker />}
            {activeTab === 'sentiment'  && <SentimentPulse />}
          </main>
        </div>
      </div>
    </div>
  );
}
