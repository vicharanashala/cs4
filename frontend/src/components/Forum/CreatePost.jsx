import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Image, Tag, AlertTriangle, Loader, Upload, Clipboard } from 'lucide-react';
import * as _BadWords from 'bad-words';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const _BadWordsFilter = _BadWords.default ?? _BadWords.Filter ?? _BadWords;
const _profanity = new _BadWordsFilter();

const ALL_TAGS = [
  'About VINS', 'Timing & Dates', 'NOC', 'Selection & Offer',
  'Work & Mentorship', 'Code of Conduct', 'Interviews', 'Certificate',
  'Rosetta', 'Phase 1 & ViBe', 'Yaksha Chat', 'ViBe Platform',
  'Team Formation', 'General', 'Technical', 'Help Needed', 'Announcements', 'Off-topic',
];

function ProfanityWarningBanner({ onDismiss }) {
  return (
    <div style={{
      backgroundColor: 'rgba(239,68,68,0.07)',
      border: '2px solid rgba(239,68,68,0.45)',
      borderRadius: '12px',
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <span style={{ fontSize: '26px', lineHeight: 1, flexShrink: 0 }}>🚫</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '15px', fontWeight: 800, color: 'rgb(220,38,38)', marginBottom: '6px', letterSpacing: '-0.01em' }}>
            Policy Violation — Inappropriate Language Detected
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(220,38,38,0.88)', lineHeight: '1.65', marginBottom: '6px' }}>
            Your post contains language that is prohibited under the{' '}
            <strong>VINS Community Forum Policy</strong>. Profanity and hostile language are not
            tolerated on this platform.{' '}
            <strong>This attempt has been recorded and will be reviewed by administrators.</strong>
          </p>
          <p style={{ fontSize: '12px', color: 'rgba(220,38,38,0.65)', lineHeight: '1.5' }}>
            Please revise your post to comply with our Community Guidelines before resubmitting.
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

export default function CreatePost({ onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '', imageUrl: '', tags: [] });
  const [step, setStep] = useState('compose'); // compose | checking | duplicates | posting
  const [duplicates, setDuplicates] = useState([]);
  const [similarityScore, setSimilarityScore] = useState(0);
  const [error, setError] = useState('');
  const [profanityWarning, setProfanityWarning] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const uploadImage = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Only image files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploadingImage(true);
    try {
      const data = new FormData();
      data.append('image', file);
      const res = await api.post('/upload/image', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm((f) => ({ ...f, imageUrl: `${window.location.origin.replace(':5173', ':5000')}${res.data.url}` }));
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  }, []);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        uploadImage(item.getAsFile());
        break;
      }
    }
  }, [uploadImage]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImage(file);
  }, [uploadImage]);

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : f.tags.length < 5 ? [...f.tags, tag] : f.tags,
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setProfanityWarning(false);
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }

    // If frontend detects profanity, skip the duplicate check and go straight to postIt
    // so the backend runs its authoritative check, logs the attempt, and returns PROFANITY_DETECTED
    let likelyProfane = false;
    try {
      if (_profanity.isProfane(form.title) || _profanity.isProfane(form.description)) {
        likelyProfane = true;
      }
    } catch { /* bad-words throws on some edge-case inputs */ }

    if (likelyProfane) {
      await postIt();
      return;
    }

    // Check duplicates first
    setStep('checking');
    try {
      const res = await api.post('/forum/posts/check-duplicate', {
        title: form.title,
        description: form.description,
      });

      if (res.data.duplicates?.length > 0) {
        setDuplicates(res.data.duplicates);
        setSimilarityScore(res.data.similarityScore);
        setStep('duplicates');
      } else {
        await postIt();
      }
    } catch {
      await postIt();
    }
  };

  const postIt = async (ignoredSimilar = false) => {
    setStep('posting');
    setError('');
    setProfanityWarning(false);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        tags: form.tags,
        imageUrl: form.imageUrl.trim() || undefined,
        ...(ignoredSimilar && { ignoredSimilar: true }),
      };
      const res = await api.post('/forum/posts', payload);
      toast.success('Post created!');
      onCreated?.(res.data.post);
      onClose();
    } catch (err) {
      if (err.response?.data?.code === 'PROFANITY_DETECTED') {
        setProfanityWarning(true);
      } else {
        setError(err.response?.data?.error || 'Failed to create post');
      }
      setStep('compose');
    }
  };

  const filteredTags = ALL_TAGS.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-down overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Create a post</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={18} /></button>
        </div>

        {/* Duplicate check overlay */}
        {step === 'checking' && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto mb-3" />
              <p className="text-[var(--text-secondary)]">Checking for similar posts...</p>
            </div>
          </div>
        )}

        {step === 'posting' && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <Loader className="w-8 h-8 animate-spin text-[var(--accent)] mx-auto mb-3" />
              <p className="text-[var(--text-secondary)]">Posting...</p>
            </div>
          </div>
        )}

        {/* Duplicates found */}
        {step === 'duplicates' && (
          <div className="flex-1 overflow-y-auto p-6">
            {(() => {
              const isHigh = similarityScore >= 85;
              const bg  = isHigh ? 'rgba(239,68,68,0.1)'  : 'rgba(234,179,8,0.1)';
              const bdr = isHigh ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)';
              const fg  = isHigh ? 'rgb(239,68,68)'       : 'rgb(234,179,8)';
              return (
                <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: bg, border: `1px solid ${bdr}` }}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={18} style={{ color: fg, flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: fg }}>
                        {isHigh ? 'Very similar post found' : 'Similar posts found'}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: fg, opacity: 0.85 }}>
                        Your post looks {similarityScore}% similar to existing posts. Does any of these answer your question?
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 mb-5">
              {duplicates.map(({ post, score, reason }) => (
                <a
                  key={post._id}
                  href={`/forum/${post._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card block p-4 hover:shadow-[var(--shadow-md)] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)] line-clamp-1">{post.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{post.description}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1 italic">{reason}</p>
                    </div>
                    <span
                      className="badge flex-shrink-0 font-bold"
                      style={score >= 85
                        ? { backgroundColor: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)' }
                        : { backgroundColor: 'rgba(234,179,8,0.12)',  color: 'rgb(234,179,8)' }}
                    >
                      {score}%
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('compose')} className="btn-secondary flex-1">
                Edit my post
              </button>
              <button onClick={() => postIt(similarityScore >= 80)} className="btn-primary flex-1" disabled={similarityScore >= 95}>
                {similarityScore >= 95 ? 'Too similar — edit first' : 'Post anyway'}
              </button>
            </div>
          </div>
        )}

        {/* Compose form */}
        {step === 'compose' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title *</label>
              <input
                type="text"
                className="input text-base"
                placeholder="What's your question or topic?"
                value={form.title}
                onChange={set('title')}
                maxLength={200}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{form.title.length}/200</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description *</label>
              <textarea
                className="textarea"
                placeholder="Describe your question or topic in detail..."
                value={form.description}
                onChange={set('description')}
                rows={6}
                maxLength={5000}
              />
              <p className="text-xs text-[var(--text-muted)] mt-1 text-right">{form.description.length}/5000</p>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1.5"><Image size={14} /> Image (optional)</span>
              </label>
              {form.imageUrl ? (
                <div className="relative inline-block">
                  <img src={form.imageUrl} alt="Preview" className="max-h-32 rounded-lg object-contain" style={{ border: '1px solid var(--border)' }} />
                  <button
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: 'rgb(239,68,68)' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <div
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onPaste={handlePaste}
                  className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader size={20} className="animate-spin" style={{ color: 'var(--accent)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={20} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Drop image, paste from clipboard, or <span style={{ color: 'var(--accent)' }}>browse</span>
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>JPEG, PNG, GIF, WebP · Max 5MB</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }}
                  />
                </div>
              )}
              {!form.imageUrl && (
                <input
                  type="url"
                  className="input mt-2 text-sm"
                  placeholder="Or paste an image URL…"
                  value={form.imageUrl}
                  onChange={set('imageUrl')}
                />
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                <span className="flex items-center gap-1.5"><Tag size={14} /> Tags <span className="text-[var(--text-muted)]">({form.tags.length}/5)</span></span>
              </label>

              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className="tag cursor-pointer transition-colors"
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = 'rgb(239,68,68)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = ''; }}
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                className="input mb-2 text-sm"
                placeholder="Search tags..."
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
              />

              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto scrollbar-thin">
                {filteredTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      form.tags.includes(tag)
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {profanityWarning && (
              <ProfanityWarningBanner onDismiss={() => setProfanityWarning(false)} />
            )}

            {error && !profanityWarning && (
              <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(239,68,68)' }}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {step === 'compose' && (
          <div className="px-6 py-4 border-t border-[var(--border)] flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!form.title.trim() || !form.description.trim()}
              className="btn-primary"
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
