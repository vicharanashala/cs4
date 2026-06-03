export default function TagFilter({ tags, selected, onToggle, onSelectAll }) {
  return (
    <div className="flex flex-wrap gap-2.5 items-center">
      <button
        onClick={onSelectAll}
        className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
          selected.length === 0
            ? 'bg-[var(--accent)] text-white shadow-sm'
            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
        }`}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onToggle(tag)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
            selected.includes(tag)
              ? 'bg-[var(--accent)] text-white shadow-sm'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
