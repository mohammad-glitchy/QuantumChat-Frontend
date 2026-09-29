import { Archive, BadgeCheck, Ban, Cake, Clock, Flag, Lock, Sparkles, UserMinus, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import client, { submitReport } from '../api/client.js';
import { getDisplayName } from '../utils/getDisplayName.js';
import { formatLastSeen } from '../utils/formatLastSeen.js';
import {
  AI_BG_THEMES,
  readStoredAiBg,
  writeStoredAiBg,
} from '../utils/aiPanelBg.js';
import ProfileHighlights from './ProfileHighlights.jsx';
import UserAvatar from './UserAvatar.jsx';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'scam_or_fraud', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
];

export default function UserProfileModal({
  userId,
  seed = null,
  online = false,
  muted = false,
  archived = false,
  isFriend = false,
  onMute,
  onArchive,
  onHide,
  onBlock,
  onRemoveFriend,
  onOpenAiPanel,
  onClose,
  onLoaded,
}) {
  const { t, i18n } = useTranslation();
  const closeRef = useRef(null);
  // A seed can be stale or privacy-shaped. Public profile fields must come only
  // from the authoritative user response, never from the chat list cache.
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiBg, setAiBg] = useState(readStoredAiBg);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

   async function handleSubmitReport() {
      if (!reportReason || !profile?.id) return;
      setReportBusy(true);
      try {
        await submitReport(profile.id, reportReason, reportDetails.trim());
        setReportDone(true);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to submit report');
      } finally {
        setReportBusy(false);
      }
    }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);

    client
      .get(`/users/${userId}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || null;
        setProfile(data);
        onLoaded?.(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Could not load profile');
        if (!seed) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps -- seed/onLoaded are open-time props

  function formatPresence(p, onl) {
    if (!p) return null;
    if (onl) return { label: t('profile.online', 'Online'), online: true };

    const lastSeenSetting = p.privacy?.lastSeen || 'everyone';
    if (lastSeenSetting === 'nobody' || !p.lastLoginAt) {
      return { label: t('profile.lastSeenHidden', 'Last seen hidden'), online: false };
    }
    const when = formatLastSeen(p.lastLoginAt, { prefix: '' });
    return {
      label: t('profile.lastSeenAt', {
        time: when,
        defaultValue: `Last seen ${when}`,
      }),
      online: false,
    };
  }

  function formatKeyRotated(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  }

  function selectAiBg(id) {
    setAiBg(id);
    writeStoredAiBg(id);
    window.dispatchEvent(new CustomEvent('qc-ai-panel-bg', { detail: id }));
  }

  const displayName = getDisplayName(profile, i18n.language) || profile?.displayName?.trim() || profile?.username || 'User';
  const username = profile?.username || '';
  const bio = (profile?.bio || '').trim();
  const statusText = (profile?.statusText || '').trim();
  const presence = formatPresence(profile, online);
  const keyRotated = formatKeyRotated(profile?.keyRotatedAt);
  const birthday = typeof profile?.birthday === 'string' ? profile.birthday.trim() : '';
  const birthdayLocked = profile?.birthdayLocked === true;
  const birthdayLabel = birthday
    ? new Date(birthday).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;
  const isAi = profile?.systemRole === 'quantum_ai' || profile?.isSystemUser;
  const showActions = Boolean(profile && (onMute || onArchive || onHide || onBlock || onRemoveFriend) && !isAi);

  return (
    <div className="create-group-overlay" role="presentation" onClick={() => onClose?.()}>
      <div
        className="user-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className="create-group-close user-profile-close"
          onClick={onClose}
          aria-label="Close profile"
        >
          <X size={18} strokeWidth={2} aria-hidden="true" />
        </button>

        <div className="user-profile-hero">
          <div className="user-profile-avatar-wrap">
            {loading && !profile ? (
              <span className="avatar user-avatar xl user-profile-avatar-skeleton" aria-hidden="true" />
            ) : (
              <UserAvatar
                userId={profile?.id || userId}
                name={displayName}
                hasAvatar={Boolean(profile?.hasAvatar)}
                size="xl"
                className="user-profile-avatar"
              />
            )}
            {presence?.online && <span className="online-dot user-profile-online-dot" aria-hidden="true" />}
          </div>

          <div className="user-profile-names">
            <h2 id="user-profile-title" className="user-profile-name">
              <span>{displayName}</span>
              {profile?.verified && (
                <span className="user-profile-verified" title="Verified">
                  <BadgeCheck size={18} strokeWidth={2.25} aria-hidden="true" />
                  <span className="sr-only">Verified</span>
                </span>
              )}
            </h2>
            {username ? <p className="user-profile-handle">@{username}</p> : null}
            {isAi ? (
              <span className="user-profile-chip user-profile-chip-ai">
                <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
                QuantumAI
              </span>
            ) : null}
            {statusText ? <p className="user-profile-status-text">{statusText}</p> : null}
          </div>

          {presence && !loading && (
            <p className={`user-profile-presence ${presence.online ? 'is-online' : ''}`}>
              <span className="user-profile-presence-dot" aria-hidden="true" />
              {presence.label}
            </p>
          )}
        </div>

        {error && <p className="user-profile-error">{error}</p>}

        {loading && !profile ? (
          <div className="user-profile-loading" aria-busy="true">
            Loading profile…
          </div>
        ) : (
          <div className="user-profile-body">
            <ProfileHighlights userId={profile?.id || userId} onError={setError} />

            {showActions && (
              <section className="user-profile-section">
                <h3 className="user-profile-section-title">Chat actions</h3>
                <div className="user-profile-actions" role="group" aria-label="Chat actions">
                  {onMute && (
                    <button
                      type="button"
                      className={`user-profile-action-btn${muted ? ' active' : ''}`}
                      title={muted ? 'Unmute' : 'Mute'}
                      aria-label={muted ? `Unmute ${displayName}` : `Mute ${displayName}`}
                      aria-pressed={muted}
                      onClick={() => onMute(profile)}
                    >
                      <VolumeX size={18} strokeWidth={2} aria-hidden="true" />
                      <span>{muted ? 'Unmute' : 'Mute'}</span>
                    </button>
                  )}
                  {onArchive && (
                    <button
                      type="button"
                      className={`user-profile-action-btn${archived ? ' active' : ''}`}
                      title={archived ? 'Unarchive' : 'Archive'}
                      aria-label={
                        archived ? `Unarchive chat with ${displayName}` : `Archive chat with ${displayName}`
                      }
                      aria-pressed={archived}
                      onClick={() => onArchive(profile)}
                    >
                      <Archive size={18} strokeWidth={2} aria-hidden="true" />
                      <span>{archived ? 'Unarchive' : 'Archive'}</span>
                    </button>
                  )}
                  {onHide && (
                    <button
                      type="button"
                      className="user-profile-action-btn"
                      title="Hide chat"
                      aria-label={`Hide chat with ${displayName}`}
                      onClick={() => onHide(profile)}
                    >
                      <X size={18} strokeWidth={2} aria-hidden="true" />
                      <span>Hide</span>
                    </button>
                  )}
                  {onBlock && (
                  <button
                    type="button"
                    className="user-profile-action-btn danger"
                    title="Block user"
                    aria-label={`Block ${displayName}`}
                    onClick={() => onBlock(profile)}
                  >
                    <Ban size={18} strokeWidth={2} aria-hidden="true" />
                    <span>Block</span>
                  </button>
                )}
                {profile?.id && (
                  <button
                    type="button"
                    className="user-profile-action-btn danger"
                    title="Report user"
                    aria-label={`Report ${displayName}`}
                    onClick={() => { setReportOpen(true); setReportDone(false); setReportReason(''); setReportDetails(''); }}
                  >
                    <Flag size={18} strokeWidth={2} aria-hidden="true" />
                    <span>Report</span>
                  </button>
                )}
                {onRemoveFriend && isFriend && (
                  <button
                    type="button"
                    className="user-profile-action-btn danger"
                    title="Remove friend"
                    aria-label={`Remove ${displayName} as a friend`}
                    onClick={() => onRemoveFriend(profile)}
                  >
                    <UserMinus size={18} strokeWidth={2} aria-hidden="true" />
                    <span>Remove Friend</span>
                  </button>
                )}
                  
                </div>
              </section>
            )}

            {reportOpen && (
              <section className="user-profile-section report-panel">
                {reportDone ? (
                  <p className="report-thanks">
                    Thanks — your report has been submitted confidentially and will be reviewed.
                  </p>
                ) : (
                  <>
                    <h3>Report {displayName}</h3>
                    <p className="settings-section-copy">
                      Your identity is never shared with the reported account.
                    </p>
                    <div className="report-reason-list">
                      {REPORT_REASONS.map((r) => (
                        <label key={r.value} className="report-reason-option">
                          <input
                            type="radio"
                            name="report-reason"
                            value={r.value}
                            checked={reportReason === r.value}
                            onChange={() => setReportReason(r.value)}
                          />
                          <span>{r.label}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      className="report-details-input"
                      placeholder="Additional details (optional)"
                      maxLength={500}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                    />
                    <div className="report-panel-actions">
                      <button type="button" onClick={() => setReportOpen(false)} disabled={reportBusy}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={!reportReason || reportBusy}
                        onClick={handleSubmitReport}
                      >
                        {reportBusy ? 'Submitting…' : 'Submit report'}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {isAi && (
              <section className="user-profile-section">
                <h3 className="user-profile-section-title">Assistant background</h3>
                <p className="user-profile-hint">
                  Skins the QuantumAI side panel (sparkle button in the chat header). Not the same as app fun themes.
                </p>
                <div className="ai-bg-control user-profile-ai-bg">
                  <div className="ai-bg-picker" role="radiogroup" aria-label="Assistant background">
                    {AI_BG_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        role="radio"
                        aria-checked={aiBg === theme.id}
                        aria-label={theme.label}
                        title={theme.label}
                        className={`ai-bg-swatch ai-bg-swatch--${theme.id}${aiBg === theme.id ? ' is-active' : ''}`}
                        onClick={() => selectAiBg(theme.id)}
                      >
                        <span className="ai-bg-swatch-name">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {onOpenAiPanel ? (
                  <button
                    type="button"
                    className="user-profile-open-ai"
                    onClick={() => {
                      onOpenAiPanel();
                      onClose?.();
                    }}
                  >
                    <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                    Open QuantumAI panel
                  </button>
                ) : null}
              </section>
            )}

            <section className="user-profile-section">
              <h3 className="user-profile-section-title">About</h3>
              {bio ? (
                <p className="user-profile-bio">{bio}</p>
              ) : (
                <p className="user-profile-empty">No bio yet</p>
              )}
            </section>

            <section className="user-profile-section">
              <h3 className="user-profile-section-title">Details</h3>
              <ul className="user-profile-meta">
                <li className="user-profile-meta-row">
                  <span className="user-profile-meta-icon" aria-hidden="true">
                    <Clock size={16} strokeWidth={2} />
                  </span>
                  <span className="user-profile-meta-copy">
                    <strong>Activity</strong>
                    <span>{presence?.label || 'Hidden'}</span>
                  </span>
                </li>
                {birthdayLabel ? (
                  <li className="user-profile-meta-row">
                    <span className="user-profile-meta-icon" aria-hidden="true">
                      <Cake size={16} strokeWidth={2} />
                    </span>
                    <span className="user-profile-meta-copy">
                      <strong>Birthday</strong>
                      <span>{birthdayLabel}</span>
                    </span>
                  </li>
                ) : birthdayLocked ? (
                  <li className="user-profile-meta-row">
                    <span className="user-profile-meta-icon" aria-hidden="true">
                      <Cake size={16} strokeWidth={2} />
                    </span>
                    <span className="user-profile-meta-copy">
                      <strong>Birthday</strong>
                      <span>Hidden</span>
                    </span>
                  </li>
                ) : null}
                <li className="user-profile-meta-row">
                  <span className="user-profile-meta-icon" aria-hidden="true">
                    <Lock size={16} strokeWidth={2} />
                  </span>
                  <span className="user-profile-meta-copy">
                    <strong>Messages</strong>
                    <span>
                      End-to-end encrypted
                      {keyRotated ? ` · keys updated ${keyRotated}` : ''}
                    </span>
                  </span>
                </li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
