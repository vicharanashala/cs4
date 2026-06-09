import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Bell, CheckCircle, Zap } from 'lucide-react';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const scoreColor = (s) =>
  s >= 80 ? '#22c55e' : s >= 60 ? '#14b8a6' : s >= 40 ? '#94a3b8' : s >= 20 ? '#f59e0b' : '#ef4444';

const SCORE_EMOJI = (s) => {
  if (s >= 80) return { emoji: '🔥', text: 'Thriving' };
  if (s >= 60) return { emoji: '🙂', text: 'Good' };
  if (s >= 40) return { emoji: '😐', text: 'Neutral' };
  if (s >= 20) return { emoji: '😟', text: 'Stressed' };
  return { emoji: '😰', text: 'Distressed' };
};

const EMOTION_COLORS = {
  positive:   '#22c55e',
  neutral:    '#94a3b8',
  negative:   '#f59e0b',
  anxious:    '#f97316',
  frustrated: '#ef4444',
};

const WINDOWS = ['5min', '15min', '1h', '6h', '24h', '3d', '7d', '30d'];

// ── sub-components ────────────────────────────────────────────────────────────

function SkeletonBlock({ height = 80 }) {
  return (
    <div
      className="animate-pulse"
      style={{
        height,
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary)',
        marginBottom: '12px',
      }}
    />
  );
}

function EmotionBar({ breakdown }) {
  const emotions = ['positive', 'neutral', 'negative', 'anxious', 'frustrated'];
  const valid = emotions.filter((k) => (breakdown[k] ?? 0) > 0);

  if (valid.length === 0) return null;

  return (
    <div>
      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          height: '20px',
          borderRadius: '99px',
          overflow: 'hidden',
          width: '100%',
          gap: '1px',
        }}
      >
        {emotions.map((key) => {
          const pct = breakdown[key] ?? 0;
          if (!pct) return null;
          return (
            <div
              key={key}
              title={`${key}: ${pct}%`}
              style={{
                width: `${pct}%`,
                backgroundColor: EMOTION_COLORS[key],
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
        {emotions.map((key) => {
          const pct = breakdown[key] ?? 0;
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: EMOTION_COLORS[key], flexShrink: 0 }}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {key} {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertRow({ alert, onAcknowledge }) {
  const isAcknowledged = !!alert.acknowledgedAt;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 0',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          marginTop: '6px',
          flexShrink: 0,
          backgroundColor: isAcknowledged ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {alert.triggerType}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Score: {Math.round((alert.currentScore + 1) * 50)} → prev: {Math.round((alert.previousScore + 1) * 50)}
          </span>
          {alert.delta !== undefined && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: alert.delta < 0 ? 'rgb(239,68,68)' : 'rgb(34,197,94)',
              }}
            >
              {alert.delta > 0 ? '+' : ''}{Math.round(alert.delta * 100) / 100}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {alert.postCount} posts · {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
          </span>
          {isAcknowledged && (
            <span style={{ fontSize: '11px', color: 'rgb(34,197,94)' }}>
              Acknowledged by {alert.acknowledgedBy?.username || 'admin'}
              {alert.adminNote ? ` — "${alert.adminNote}"` : ''}
            </span>
          )}
        </div>
      </div>

      {!isAcknowledged && (
        <button
          onClick={() => onAcknowledge(alert._id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid rgba(34,197,94,0.3)',
            backgroundColor: 'rgba(34,197,94,0.08)',
            color: 'rgb(34,197,94)',
            flexShrink: 0,
          }}
        >
          <CheckCircle size={12} /> Acknowledge
        </button>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function SentimentPulse() {
  const [window, setWindow]   = useState('7d');
  const [sentData, setSentData] = useState(null);
  const [alerts, setAlerts]   = useState([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [error, setError]     = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const refreshTimerRef = useRef(null);

  const fetchSentiment = useCallback(async (win) => {
    setLoadingSent(true);
    setError(null);
    try {
      const res = await api.get('/admin/sentiment', { params: { window: win } });
      setSentData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load sentiment data');
    } finally {
      setLoadingSent(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await api.get('/admin/sentiment/alerts');
      setAlerts(res.data.alerts || []);
    } catch {
      // non-fatal
    } finally {
      setLoadingAlerts(false);
    }
  }, []);

  useEffect(() => { fetchSentiment(window); }, [window, fetchSentiment]);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current); }, []);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await api.post('/admin/sentiment/run-analysis');
      const { queued } = res.data;
      if (queued === 0) {
        toast.success('All posts and comments are already analyzed.');
        setAnalyzing(false);
        return;
      }
      toast.success(`Analyzing ${queued} item${queued !== 1 ? 's' : ''} in the background…`);
      // Auto-refresh once per 10s until analyzing state is cleared
      const scheduleRefresh = (delay) => {
        refreshTimerRef.current = setTimeout(async () => {
          await fetchSentiment(window);
          setAnalyzing(false);
        }, delay);
      };
      scheduleRefresh(10000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start analysis');
      setAnalyzing(false);
    }
  };

  const handleAcknowledge = async (alertId) => {
    try {
      const res = await api.patch(`/admin/sentiment/alerts/${alertId}/acknowledge`, {});
      setAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? res.data.alert : a))
      );
      toast.success('Alert acknowledged');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to acknowledge alert');
    }
  };

  const handleWindowChange = (win) => {
    setWindow(win);
  };

  const label = sentData && !sentData.insufficientData ? SCORE_EMOJI(sentData.overallScore) : null;

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Sentiment Pulse
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleRunAnalysis}
            disabled={analyzing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: analyzing ? 'not-allowed' : 'pointer',
              border: '1px solid rgba(139,92,246,0.4)',
              backgroundColor: analyzing ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.1)',
              color: analyzing ? 'var(--text-muted)' : 'rgb(139,92,246)',
              opacity: analyzing ? 0.7 : 1,
              transition: 'all 0.15s',
            }}
          >
            <Zap size={13} style={{ animation: analyzing ? 'pulse 1.2s ease-in-out infinite' : 'none' }} />
            {analyzing ? 'Analyzing…' : 'Run Analysis'}
          </button>
          <button
            onClick={() => { fetchSentiment(window); fetchAlerts(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Window selector */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {WINDOWS.map((win) => (
          <button
            key={win}
            onClick={() => handleWindowChange(win)}
            style={{
              padding: '5px 14px',
              borderRadius: '99px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: window === win ? 'var(--accent)' : 'var(--border)',
              backgroundColor: window === win ? 'var(--accent)' : 'transparent',
              color: window === win ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.15s',
            }}
          >
            {win}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'rgb(239,68,68)',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Sentiment score card */}
      <div className="card" style={{ padding: '28px', marginBottom: '16px' }}>
        {loadingSent ? (
          <>
            <SkeletonBlock height={96} />
            <SkeletonBlock height={24} />
          </>
        ) : sentData?.insufficientData ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: '40px', marginBottom: '8px' }}>📊</p>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Not enough data yet
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              At least 3 posts with sentiment scores are needed for this window.
            </p>
          </div>
        ) : sentData ? (
          <>
            {/* Score display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <p
                  style={{
                    fontSize: '72px',
                    fontWeight: 800,
                    lineHeight: 1,
                    color: scoreColor(sentData.overallScore),
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sentData.overallScore}
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>/ 100</p>
              </div>
              <div>
                <p style={{ fontSize: '32px', marginBottom: '4px' }}>
                  {label?.emoji} <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{label?.text}</span>
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Based on {sentData.postCount?.toLocaleString()} post{sentData.postCount !== 1 ? 's' : ''} in this period
                </p>
              </div>
            </div>

            {/* Emotion breakdown */}
            {sentData.emotionBreakdown && (
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Emotion breakdown
                </p>
                <EmotionBar breakdown={sentData.emotionBreakdown} />
              </div>
            )}

            {/* Mini time series */}
            {sentData.timeSeriesData?.length > 1 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Trend
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '48px' }}>
                  {sentData.timeSeriesData.map((point, i) => {
                    const maxScore = Math.max(...sentData.timeSeriesData.map((p) => p.score), 1);
                    const heightPct = (point.score / Math.max(maxScore, 100)) * 100;
                    return (
                      <div
                        key={i}
                        title={`${new Date(point.timestamp).toLocaleDateString()} — score: ${point.score}`}
                        style={{
                          flex: 1,
                          minWidth: '4px',
                          height: `${Math.max(4, heightPct)}%`,
                          borderRadius: '3px',
                          backgroundColor: scoreColor(point.score),
                          opacity: 0.8,
                          transition: 'height 0.3s ease',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Alerts section */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Bell size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
            Sentiment Alerts
          </h3>
          {alerts.filter((a) => !a.acknowledgedAt).length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '99px',
                backgroundColor: 'rgba(239,68,68,0.12)',
                color: 'rgb(239,68,68)',
              }}
            >
              {alerts.filter((a) => !a.acknowledgedAt).length} unacknowledged
            </span>
          )}
        </div>

        {loadingAlerts ? (
          [...Array(3)].map((_, i) => <SkeletonBlock key={i} height={52} />)
        ) : alerts.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
            No alerts yet
          </p>
        ) : (
          <div>
            {alerts.map((alert) => (
              <AlertRow key={alert._id} alert={alert} onAcknowledge={handleAcknowledge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
