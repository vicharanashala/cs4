import { X } from 'lucide-react';

const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'May 26, 2026',
    content: [
      {
        heading: 'What we collect',
        body: `When you create an account on the VINS Community platform, we collect your username, email address, and hashed password. We do not store plaintext passwords. When you interact with the forum — posting, commenting, or voting — we record those actions along with timestamps and your IP address for security and moderation purposes.`,
      },
      {
        heading: 'How we use your data',
        body: `Your data is used to:\n• Operate your account and authenticate you securely\n• Display your posts and contributions to the community\n• Detect spam, abuse, and duplicate content\n• Generate anonymous aggregate statistics for programme improvement\n• Provide context to the AI assistant (Yaksha) when you use it\n\nWe do not sell, rent, or share your personal data with third parties for marketing.`,
      },
      {
        heading: 'AI features',
        body: `The Yaksha chatbot and the duplicate-post detector use the OpenRouter API (powered by Anthropic's Claude models). Messages you send to Yaksha and post content you submit for duplicate checking are transmitted to OpenRouter's API. These requests are subject to OpenRouter's and Anthropic's privacy policies. We do not permanently store your chatbot conversation history.`,
      },
      {
        heading: 'Cookies and tokens',
        body: `We use httpOnly cookies to store authentication tokens. These cannot be read by JavaScript and are protected against cross-site scripting attacks. A CSRF token cookie (readable by our frontend only) is also set to protect against cross-site request forgery. No advertising or analytics cookies are used.`,
      },
      {
        heading: 'Data retention',
        body: `Activity logs are automatically deleted after 90 days. Account data is retained as long as your account is active. If you wish to have your account or data removed, contact an administrator through the platform.`,
      },
      {
        heading: 'Security',
        body: `Passwords are hashed with bcrypt (12 rounds). Access tokens expire every 15 minutes. We employ rate limiting, input sanitisation, and NoSQL injection prevention. While we take reasonable precautions, no system is completely impenetrable — please use a strong, unique password.`,
      },
      {
        heading: 'Contact',
        body: `For privacy concerns, contact the platform administrator via the admin email displayed on the About page, or raise an escalation through Yaksha chat on samagama.in.`,
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    updated: 'May 26, 2026',
    content: [
      {
        heading: 'Acceptance',
        body: `By creating an account and using the VINS Community platform, you agree to these Terms of Service. If you do not agree, do not use this platform.`,
      },
      {
        heading: 'Eligibility',
        body: `This platform is for participants of the VINS (Vicharanashala Internship) programme and authorised members of the Vicharanashala community. Use by others is not permitted.`,
      },
      {
        heading: 'Conduct',
        body: `You agree not to:\n• Post hateful, abusive, or harassing content\n• Share personal information of others without consent\n• Impersonate other users or programme staff\n• Spam or deliberately flood the forum with duplicate posts\n• Attempt to circumvent the profanity filter\n• Use the platform for any unlawful purpose\n\nPosts that violate these rules may be hidden by administrators without notice.`,
      },
      {
        heading: 'Content ownership',
        body: `You retain ownership of content you post. By posting, you grant the platform a non-exclusive licence to display and store your content for the operation of the service. We do not claim ownership of your contributions.`,
      },
      {
        heading: 'No delete policy',
        body: `In line with the programme's emphasis on accountability and transparency, users cannot delete their own posts or comments. Administrators may hide content that violates these terms. This policy helps preserve context in community discussions.`,
      },
      {
        heading: 'Termination',
        body: `Administrators may suspend or terminate accounts that violate these terms, without prior notice in cases of serious violations.`,
      },
      {
        heading: 'Disclaimer',
        body: `This platform is provided "as is." We make no guarantees about uptime or accuracy of AI-generated responses. The Yaksha chatbot is a helpful tool but may occasionally be incorrect — always verify important information through official programme communications.`,
      },
    ],
  },

  conduct: {
    title: 'Community Guidelines',
    updated: 'May 30, 2026',
    content: [
      {
        heading: 'Be constructive',
        body: `Ask questions clearly, provide context, and help others with the same generosity you'd want for yourself. The forum works best when everyone contributes something.`,
      },
      {
        heading: 'Search before you post',
        body: `Use the search bar and browse existing posts before creating a new one. The AI duplicate detector will flag very similar questions automatically, but a quick search first saves everyone time.`,
      },
      {
        heading: 'Tag appropriately',
        body: `Choose tags that accurately reflect your post's topic. Good tagging helps people find relevant answers and helps the community stay organised.`,
      },
      {
        heading: 'Stay on topic',
        body: `The VINS forum is for questions and discussions related to the internship programme. Off-topic posts may be hidden by moderators.`,
      },
      {
        heading: 'Zero tolerance for profanity and hostility',
        body: `Every post, comment, and reply is scanned by an automatic profanity filter before it is published. Content containing prohibited language is blocked immediately and never reaches the community.\n\nBeyond technical filtering, we expect respectful and professional communication at all times. Attacking, mocking, insulting, or dismissing other community members — in any form — is not acceptable and will be treated as a policy violation.\n\nEvery blocked profanity attempt is automatically logged with full details (account, timestamp, content preview, and device information) and is reviewed by administrators.`,
      },
      {
        heading: 'Upvote thoughtfully',
        body: `Upvote posts and comments that are genuinely helpful or well-written. Downvote content that is misleading or unhelpful — not just content you disagree with.`,
      },
      {
        heading: 'Official information only',
        body: `Do not spread unverified information about the programme. If you're unsure about something, ask Yaksha or escalate through official channels rather than guessing in a post.`,
      },
      {
        heading: 'Enforcement',
        body: `Violations of these guidelines are subject to progressive enforcement:\n\n• First offence: Warning displayed at the time of the attempt\n• Repeated offences: Temporary timeout (posting and voting suspended)\n• Serious or persistent violations: Permanent ban from the platform\n\nAll moderation actions are logged and administrators may act without prior notice in cases of serious violations. If you believe a moderation action was applied in error, contact an administrator through official programme channels.`,
      },
    ],
  },
};

export default function PolicyModal({ type, onClose }) {
  const policy = POLICIES[type];
  if (!policy || !type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl animate-slide-up overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{policy.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Last updated: {policy.updated}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg"><X size={18} /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
          {policy.content.map(({ heading, body }) => (
            <div key={heading}>
              <h3 className="text-sm font-black mb-2" style={{ color: 'var(--accent)' }}>{heading}</h3>
              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          ))}
        </div>

        <div
          className="px-6 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button onClick={onClose} className="btn-primary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}
