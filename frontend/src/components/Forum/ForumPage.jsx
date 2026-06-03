import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, X, Filter, TrendingUp, Clock, Flame, Users } from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import PostCard from './PostCard';
import CreatePost from './CreatePost';
import LoginModal from '../Auth/LoginModal';
import MemberPanel from './MemberPanel';
import SearchModal from './SearchModal';

const TAGS = [
  'About VINS', 'Timing & Dates', 'NOC', 'Selection & Offer',
  'Work & Mentorship', 'Code of Conduct', 'Interviews', 'Certificate',
  'Rosetta', 'Phase 1 & ViBe', 'Yaksha Chat', 'ViBe Platform',
  'Team Formation', 'General', 'Technical', 'Help Needed', 'Announcements', 'Off-topic',
  'Ignored Similar Post',
];

const SORT_OPTIONS = [
  { value: 'top',    label: 'Top',    icon: TrendingUp },
  { value: 'new',    label: 'New',    icon: Clock },
  { value: 'active', label: 'Active', icon: Flame },
];

const PERIOD_OPTIONS = [
  { value: 'day',   label: 'Today' },
  { value: 'week',  label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all',   label: 'All time' },
];

export default function ForumPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [posts, setPosts]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort]               = useState('top');
  const [period, setPeriod]           = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [showCreate, setShowCreate]   = useState(false);
  const [showLogin, setShowLogin]     = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(true);
  const [pagination, setPagination]   = useState({ page: 1, pages: 1, total: 0 });

  // Ctrl+K / Cmd+K shortcut for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchPosts = useCallback(async (page = 1, append = false) => {
    if (!user) { setLoading(false); return; }
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        sort, period, page, limit: 20,
        ...(selectedTags.length > 0 && { tags: selectedTags.join(',') }),
      });
      const res = await api.get(`/forum/posts?${params}`);
      if (append) setPosts(p => [...p, ...res.data.posts]);
      else        setPosts(res.data.posts);
      setPagination(res.data.pagination);
    } catch { /* silent */ } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort, period, selectedTags, user]);

  useEffect(() => { fetchPosts(1); }, [fetchPosts]);

  const toggleTag = tag =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const isLoggedIn = !!user;

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container py-14">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div style={{ width: 3, height: 20, backgroundColor: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
                <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--accent)' }}>
                  Community Forum
                </span>
              </div>
              <h1
                className="font-black leading-[1.05] mb-3"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
              >
                Ask, share,{' '}
                <span style={{ color: 'var(--accent)' }}>connect.</span>
              </h1>
              <p className="text-base mb-0" style={{ color: 'var(--text-secondary)', maxWidth: '32rem' }}>
                The VINS community — discuss the programme, share learnings, and help fellow interns.
              </p>
              {pagination.total > 0 && (
                <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-muted)' }}>
                  {pagination.total.toLocaleString()} post{pagination.total !== 1 ? 's' : ''} from the community
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Admin: member panel toggle */}
              {isAdmin && (
                <button
                  onClick={() => setMemberPanelOpen(v => !v)}
                  className="hidden xl:flex btn-secondary items-center gap-2 px-3 py-2"
                  title={memberPanelOpen ? 'Hide member list' : 'Show member list'}
                  style={memberPanelOpen ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
                >
                  <Users size={15} />
                  <span className="text-sm">Members</span>
                </button>
              )}
              {/* Search button */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="btn-secondary flex items-center gap-2 px-3 py-2"
                title="Search (Ctrl+K)"
              >
                <Search size={15} />
                <span className="text-sm hidden sm:inline">Search</span>
                <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  Ctrl K
                </kbd>
              </button>
              {/* New post */}
              <button
                onClick={() => isLoggedIn ? setShowCreate(true) : setShowLogin(true)}
                className="btn-primary px-5 py-2.5 text-[15px]"
              >
                <Plus size={17} />
                New Post
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="flex gap-7">
          {/* Tag sidebar — left */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="card p-4 sticky top-24">
              <div className="flex items-center gap-2 mb-3">
                <Filter size={13} style={{ color: 'var(--accent)' }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Filter</span>
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedTags([])}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: selectedTags.length === 0 ? 'var(--accent-light)' : 'transparent',
                    color: selectedTags.length === 0 ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  All posts
                </button>
                {TAGS.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors"
                    style={{
                      backgroundColor: selectedTags.includes(tag) ? 'var(--accent-light)' : 'transparent',
                      color: selectedTags.includes(tag) ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: selectedTags.includes(tag) ? 600 : 400,
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* ── Auth wall — no data is fetched or rendered until signed in ── */}
            {!isLoggedIn ? (
              <div className="card p-12 text-center max-w-lg mx-auto mt-8">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Sign in to view the forum
                </h3>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  This community is for VINS interns only. Sign in to read posts, join discussions, and connect with fellow interns.
                </p>
                <button onClick={() => setShowLogin(true)} className="btn-primary px-8 py-2.5 text-base">
                  Sign in
                </button>
              </div>
            ) : (
            <div className="relative">

              {/* Sort + period controls */}
              <div className="flex items-center gap-3 flex-wrap mb-5">
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSort(value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: sort === value ? 'var(--accent)' : 'transparent',
                        color: sort === value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      <Icon size={13} />{label}
                    </button>
                  ))}
                </div>

                {sort === 'top' && (
                  <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                    {PERIOD_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setPeriod(value)}
                        className="px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: period === value ? 'var(--bg-tertiary)' : 'transparent',
                          color: period === value ? 'var(--text-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Post list */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="card h-28 animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="card text-center py-16">
                  <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No posts yet</p>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Be the first to start a discussion!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {posts.map(post => (
                    <PostCard
                      key={post._id}
                      post={post}
                      onLoginRequired={() => setShowLogin(true)}
                      onVoteUpdate={(id, score, vote) =>
                        setPosts(ps => ps.map(p => p._id === id ? { ...p, voteScore: score, userVote: vote } : p))
                      }
                      onUpdate={(id, changes) =>
                        setPosts(ps => ps.map(p => p._id === id ? { ...p, ...changes } : p))
                      }
                      onDelete={(id) =>
                        setPosts(ps => ps.filter(p => p._id !== id))
                      }
                    />
                  ))}
                </div>
              )}

              {pagination.page < pagination.pages && (
                <div className="text-center mt-6">
                  <button
                    onClick={() => fetchPosts(pagination.page + 1, true)}
                    disabled={loadingMore}
                    className="btn-secondary"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
            )} {/* end isLoggedIn */}
          </div>

          {/* Member panel — inline flex column at xl+ when open */}
          {isAdmin && memberPanelOpen && (
            <div
              className="hidden xl:flex flex-shrink-0"
              style={{ width: 260, alignSelf: 'stretch' }}
            >
              <div className="sticky top-20" style={{ height: 'calc(100vh - 96px)', width: '100%' }}>
                <MemberPanel />
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && <CreatePost onClose={() => setShowCreate(false)} onCreated={post => setPosts(p => [post, ...p])} />}
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
      {isSearchOpen && <SearchModal onClose={() => setIsSearchOpen(false)} />}
    </div>
  );
}
