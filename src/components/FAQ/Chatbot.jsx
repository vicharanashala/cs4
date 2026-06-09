import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, ChevronDown } from 'lucide-react';
import api from '../../lib/api';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm Yaksha, your VINS assistant. Ask me anything about the internship programme." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/chatbot/chat', {
        message: text,
        history: messages.slice(-10),
      });
      setMessages((m) => [...m, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: err.response?.data?.error || 'Sorry, I ran into an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
      {/* Chat window */}
      {open && (
        <div className="card w-[360px] max-w-[calc(100vw-32px)] flex flex-col shadow-[var(--shadow-lg)] animate-slide-up overflow-hidden" style={{ height: '480px' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Yaksha</p>
                <p className="text-xs text-[var(--success)]">● Online</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="btn-ghost p-1.5 rounded-lg">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white ${
                  msg.role === 'user' ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
                }`}>
                  {msg.role === 'user'
                    ? <User size={13} className="text-white" />
                    : <Bot size={13} className="text-[var(--accent)]" />
                  }
                </div>
                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-white rounded-tr-sm'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full flex-shrink-0 bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <Bot size={13} className="text-[var(--accent)]" />
                </div>
                <div className="bg-[var(--bg-tertiary)] px-3 py-2 rounded-xl rounded-tl-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-[var(--text-muted)] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--border)] p-3 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about the internship..."
              className="input resize-none py-2 text-sm min-h-0"
              rows={1}
              style={{ height: '38px' }}
              disabled={loading}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="btn-primary px-3 py-2 flex-shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-lg)] flex items-center justify-center hover:bg-[var(--accent-hover)] transition-all hover:scale-105 active:scale-95"
        aria-label="Open chatbot"
      >
        {open ? <ChevronDown size={22} /> : <MessageSquare size={22} />}
      </button>
    </div>
  );
}
