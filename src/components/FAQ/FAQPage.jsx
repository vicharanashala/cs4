import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { getOrCreateSessionId, normalizeQuery } from '../../lib/deviceFingerprint';
import FAQItem from './FAQItem';
import Chatbot from './Chatbot';

const _faqLoggedDeadEnds = new Set();

export default function FAQPage() {
  const { user }                        = useAuth();
  const [faqData, setFaqData]           = useState([]);
  const [search, setSearch]             = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading]           = useState(true);
  const deadEndTimerRef                 = useRef(null);

  useEffect(() => {
    api.get('/faq')
      .then(res  => setFaqData(res.data.faq))
      .catch(()  => setFaqData([]))
      .finally(() => setLoading(false));
  }, []);

  const allTags = useMemo(() => faqData.map(s => s.main), [faqData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return faqData
      .map(section => {
        if (selectedTags.length > 0 && !selectedTags.includes(section.main)) return null;
        const subs = (section.sub || []).filter(item =>
          !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q)
        );
        if (!subs.length) return null;
        return { ...section, sub: subs };
      })
      .filter(Boolean);
  }, [faqData, search, selectedTags]);

  const totalResults   = filtered.reduce((s, sec) => s + (sec.sub?.length ?? 0), 0);
  const totalQuestions = faqData.reduce((s, sec) => s + (sec.sub?.length ?? 0), 0);

  useEffect(() => {
    clearTimeout(deadEndTimerRef.current);

    if (!user || loading || totalResults > 0) return;
    const norm = normalizeQuery(search);
    if (norm.length < 3 || /^\d+$/.test(norm) || _faqLoggedDeadEnds.has(norm)) return;

    deadEndTimerRef.current = setTimeout(async () => {
      _faqLoggedDeadEnds.add(norm);
      try {
        await api.post('/forum/dead-end', {
          query: search.trim(),
          normalizedQuery: norm,
          outcomeType: 'zero_results',
          sessionId: getOrCreateSessionId(),
        });
      } catch {
        _faqLoggedDeadEnds.delete(norm);
      }
    }, 800);

    return () => clearTimeout(deadEndTimerRef.current);
  }, [search, totalResults, user, loading]);

  const toggleTag = tag =>
    setSelectedTags(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag]);

  return (
    <div>
      {/* ── Hero ── */}
      <div style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container py-14">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-5">
              <div style={{ width: 3, height: 20, backgroundColor: 'var(--accent)', borderRadius: 2, flexShrink: 0 }} />
              <span className="text-xs font-bold uppercase tracking-[0.15em]" style={{ color: 'var(--accent)' }}>
                Internship Knowledge Base
              </span>
            </div>

            <h1
              className="font-black leading-[1.05] mb-4"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
            >
              Got questions<br />about{' '}
              <span style={{ color: 'var(--accent)' }}>VINS?</span>
            </h1>

            <p className="text-lg mb-1" style={{ color: 'var(--text-secondary)', maxWidth: '36rem' }}>
              Everything you need to know about the Vicharanashala Internship Programme.
            </p>
            <p className="text-sm font-medium mb-8" style={{ color: 'var(--text-muted)' }}>
              {totalQuestions} answers across {faqData.length} categories
            </p>

            {/* Search */}
            <div className="relative max-w-xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input pl-12 pr-12 py-3.5 text-base"
                placeholder="Search questions and answers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sidebar + content ── */}
      <div className="page-container pt-8 pb-16">
        <div className="flex gap-8">
          {/* Tag sidebar */}
          <div className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
                Categories
              </p>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedTags([])}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTags.length === 0
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  All Topics
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-[var(--accent)] text-white'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Results count */}
            {(search || selectedTags.length > 0) && (
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{totalResults}</span>{' '}
                result{totalResults !== 1 ? 's' : ''}
                {search && <> for "<span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{search}</span>"</>}
              </p>
            )}

            {/* FAQ sections */}
            {loading ? (
              <div className="space-y-3 max-w-4xl">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="card h-24 animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <Search size={44} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
                <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No results</p>
                <p style={{ color: 'var(--text-secondary)' }}>Try a different search term or clear the filters.</p>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl">
                {filtered.map((section) => {
                  const num = String(
                    faqData.findIndex(s => s.main === section.main) + 1
                  ).padStart(2, '0');
                  return (
                    <div
                      key={section.main}
                      className="card overflow-hidden"
                      style={{ borderLeft: '3px solid var(--accent)' }}
                    >
                      <div
                        className="px-5 py-3.5 flex items-center gap-3"
                        style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <span
                          className="font-black tabular-nums"
                          style={{ color: 'var(--accent)', fontSize: '1.1rem', letterSpacing: '-0.02em', opacity: 0.7 }}
                        >
                          {num}
                        </span>
                        <h2 className="flex-1 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          {section.main}
                        </h2>
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                        >
                          {section.sub.length} Q{section.sub.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {section.sub.map((item, i) => (
                        <FAQItem key={i} question={item.question} answer={item.answer} highlight={search} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Chatbot />
    </div>
  );
}