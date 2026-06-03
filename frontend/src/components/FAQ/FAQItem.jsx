import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function FAQItem({ question, answer, highlight = '' }) {
  const [open, setOpen] = useState(false);

  const highlightText = (text) => {
    if (!highlight.trim()) return text;
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <mark key={i} style={{ backgroundColor: 'rgba(234,179,8,0.28)', color: 'inherit' }} className="rounded-sm px-0.5">{part}</mark>
      ) : part
    );
  };

  return (
    <div className={`border-b border-[var(--border-subtle)] last:border-0 transition-colors ${open ? 'bg-[var(--bg-secondary)]' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left hover:bg-[var(--bg-secondary)] transition-colors group"
        aria-expanded={open}
      >
        <span className="text-[15px] font-medium text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors">
          {highlightText(question)}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 mt-0.5 text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div className={`collapse-content ${open ? 'open' : 'closed'}`}>
        <div className="px-5 pb-4 pt-0">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
            {highlightText(answer)}
          </p>
        </div>
      </div>
    </div>
  );
}
