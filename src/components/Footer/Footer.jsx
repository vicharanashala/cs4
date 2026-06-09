import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, MessageSquare, Shield, Github, ExternalLink } from 'lucide-react';
import PolicyModal from './PolicyModal';

export default function Footer() {
  const [policy, setPolicy] = useState(null); // 'privacy' | 'terms' | 'conduct' | null

  const year = new Date().getFullYear();

  return (
    <>
      <footer
        className="mt-20"
        style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="page-container py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <span className="text-white font-black text-lg">V</span>
                </div>
                <div>
                  <p className="font-black text-lg leading-none" style={{ color: 'var(--text-primary)' }}>VINS Community</p>
                  <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>Vicharanashala Internship · IIT Ropar</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                A community platform for VINS interns to ask questions, share knowledge, and connect
                with fellow participants across all cohorts.
              </p>
              <div className="flex items-center gap-2 mt-5">
                <a
                  href="https://samagama.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <ExternalLink size={12} />
                  samagama.in
                </a>
                <span style={{ color: 'var(--border)' }}>·</span>
                <a
                  href="https://vicharanashala.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <ExternalLink size={12} />
                  vicharanashala.ai
                </a>
              </div>
            </div>

            {/* Navigation */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Platform
              </p>
              <ul className="space-y-2.5">
                {[
                  { to: '/',      label: 'FAQ',          icon: HelpCircle },
                  { to: '/forum', label: 'Community Forum', icon: MessageSquare },
                  { to: '/admin', label: 'Admin Panel',  icon: Shield },
                ].map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      className="flex items-center gap-2 text-sm font-medium transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      <Icon size={13} />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                Legal
              </p>
              <ul className="space-y-2.5">
                {[
                  { key: 'privacy', label: 'Privacy Policy' },
                  { key: 'terms',   label: 'Terms of Service' },
                  { key: 'conduct', label: 'Community Guidelines' },
                ].map(({ key, label }) => (
                  <li key={key}>
                    <button
                      onClick={() => setPolicy(key)}
                      className="text-sm font-medium text-left transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-10 pt-6"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              © {year} Vicharanashala Lab for Education Design, IIT Ropar. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Powered by</span>
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>MongoDB · Express · React · Node.js</span>
              <span>·</span>
              <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>OpenRouter AI</span>
            </div>
          </div>
        </div>
      </footer>

      {policy && <PolicyModal type={policy} onClose={() => setPolicy(null)} />}
    </>
  );
}
