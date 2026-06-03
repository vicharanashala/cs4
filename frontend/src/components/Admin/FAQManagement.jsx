import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, X, Check, BookOpen } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const EMPTY_Q = { question: '', answer: '' };

export default function FAQManagement() {
  const [categories, setCategories]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState(null);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName]         = useState('');
  const [catSaving, setCatSaving]     = useState(false);

  // Question modal state: { categoryId, mode: 'add'|'edit', questionId?, data }
  const [qModal, setQModal]           = useState(null);
  const [qSaving, setQSaving]         = useState(false);

  useEffect(() => {
    api.get('/admin/faq')
      .then(res => setCategories(res.data.categories))
      .catch(() => toast.error('Failed to load FAQ'))
      .finally(() => setLoading(false));
  }, []);

  // ── Category actions ─────────────────────────────────────────────
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      const res = await api.post('/admin/faq', { main: catName.trim() });
      setCategories(c => [...c, res.data.category]);
      setCatName('');
      setShowCatForm(false);
      toast.success('Category created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    if (!confirm(`Delete category "${cat.main}" and all ${cat.sub.length} questions? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/faq/${cat._id}`);
      setCategories(c => c.filter(x => x._id !== cat._id));
      toast.success('Category deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  // ── Question actions ─────────────────────────────────────────────
  const openAddQuestion = (catId) => setQModal({ categoryId: catId, mode: 'add', data: { ...EMPTY_Q } });
  const openEditQuestion = (catId, q) => setQModal({ categoryId: catId, mode: 'edit', questionId: q._id, data: { question: q.question, answer: q.answer } });

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!qModal.data.question.trim() || !qModal.data.answer.trim()) return;
    setQSaving(true);
    try {
      let res;
      if (qModal.mode === 'add') {
        res = await api.post(`/admin/faq/${qModal.categoryId}/questions`, qModal.data);
        toast.success('Question added');
      } else {
        res = await api.put(`/admin/faq/${qModal.categoryId}/questions/${qModal.questionId}`, qModal.data);
        toast.success('Question updated');
      }
      setCategories(c => c.map(cat => cat._id === qModal.categoryId ? res.data.category : cat));
      setQModal(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setQSaving(false);
    }
  };

  const handleDeleteQuestion = async (cat, q) => {
    if (!confirm(`Delete this question?`)) return;
    try {
      const res = await api.delete(`/admin/faq/${cat._id}/questions/${q._id}`);
      setCategories(c => c.map(x => x._id === cat._id ? res.data.category : x));
      toast.success('Question deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="card h-14 animate-pulse" style={{ backgroundColor: 'var(--bg-secondary)' }} />)}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          FAQ Management
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
            ({categories.length} categories · {categories.reduce((s, c) => s + c.sub.length, 0)} questions)
          </span>
        </h2>
        <button onClick={() => setShowCatForm(v => !v)} className="btn-primary">
          <Plus size={15} />
          Add Category
        </button>
      </div>

      {/* New category inline form */}
      {showCatForm && (
        <form onSubmit={handleCreateCategory} className="card p-4 flex gap-3 items-center">
          <input
            autoFocus
            type="text"
            className="input flex-1"
            placeholder="Category name (e.g. Team Formation)"
            value={catName}
            onChange={e => setCatName(e.target.value)}
            required
          />
          <button type="submit" disabled={catSaving || !catName.trim()} className="btn-primary px-4">
            {catSaving ? '...' : 'Create'}
          </button>
          <button type="button" onClick={() => { setShowCatForm(false); setCatName(''); }} className="btn-ghost p-2 rounded-lg">
            <X size={16} />
          </button>
        </form>
      )}

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat._id} className="card overflow-hidden">
            {/* Category header row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
              onClick={() => setExpanded(expanded === cat._id ? null : cat._id)}
            >
              <div style={{ color: 'var(--text-muted)' }}>
                {expanded === cat._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <BookOpen size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{cat.main}</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
                {cat.sub.length} Q{cat.sub.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={e => { e.stopPropagation(); openAddQuestion(cat._id); }}
                className="btn-ghost px-2 py-1 rounded text-xs flex items-center gap-1"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={12} /> Add Q
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteCategory(cat); }}
                className="btn-ghost p-1.5 rounded"
                style={{ color: 'rgb(239,68,68)' }}
                title="Delete category"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Questions */}
            {expanded === cat._id && (
              <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {cat.sub.length === 0 ? (
                  <p className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No questions yet.{' '}
                    <button onClick={() => openAddQuestion(cat._id)} style={{ color: 'var(--accent)' }} className="font-medium">Add one →</button>
                  </p>
                ) : cat.sub.map((q) => (
                  <div key={q._id} className="px-4 py-3 flex items-start gap-3 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{q.question}</p>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{q.answer}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditQuestion(cat._id, q)} className="btn-ghost p-1.5 rounded" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDeleteQuestion(cat, q)} className="btn-ghost p-1.5 rounded" style={{ color: 'rgb(239,68,68)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Question modal */}
      {qModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setQModal(null)} />
          <form
            onSubmit={handleSaveQuestion}
            className="relative card p-6 w-full max-w-lg space-y-4 animate-slide-down"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {qModal.mode === 'add' ? 'Add Question' : 'Edit Question'}
              </h3>
              <button type="button" onClick={() => setQModal(null)} className="btn-ghost p-1.5 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Question</label>
              <input
                autoFocus
                type="text"
                className="input"
                placeholder="What is...?"
                value={qModal.data.question}
                onChange={e => setQModal(m => ({ ...m, data: { ...m.data, question: e.target.value } }))}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Answer</label>
              <textarea
                className="textarea"
                placeholder="The answer is..."
                rows={5}
                value={qModal.data.answer}
                onChange={e => setQModal(m => ({ ...m, data: { ...m.data, answer: e.target.value } }))}
                required
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setQModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={qSaving} className="btn-primary flex-1">
                {qSaving ? '...' : qModal.mode === 'add' ? 'Add Question' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
