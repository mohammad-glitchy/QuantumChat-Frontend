import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import StoryMentionPicker from './StoryMentionPicker.jsx';

const TTL_PRESETS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { label: '3 days', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
];
const DEFAULT_TTL_MS = TTL_PRESETS[2].ms;
const MIN_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function defaultScheduleLocalValue() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function useStoryPublishOptions(initialTtl = DEFAULT_TTL_MS) {
  const [preset, setPreset] = useState(initialTtl);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState(24);
  const [customUnit, setCustomUnit] = useState('hours');
  const [allowReplies, setAllowReplies] = useState(true);
  const [viewOnce, setViewOnce] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState(defaultScheduleLocalValue);
  const [caption, setCaption] = useState('');
  const [captionMode, setCaptionMode] = useState('fixed'); // 'fixed' (WhatsApp) | 'free' (Instagram)
  const [captionStyle, setCaptionStyle] = useState({
    x: 50, y: 85, fontSize: 22, color: '#ffffff', background: 'rgba(0,0,0,0.35)', align: 'center',
  });
  const [mentions, setMentions] = useState([]); // [{ id, username, visibility: 'public'|'hidden' }]

  function computeTtlMs() {
    if (customMode) {
      const raw = Number(customValue) || 0;
      const mult =
        customUnit === 'minutes'
          ? 60 * 1000
          : customUnit === 'days'
            ? 24 * 60 * 60 * 1000
            : 60 * 60 * 1000;
      return Math.min(Math.max(raw * mult, MIN_TTL_MS), MAX_TTL_MS);
    }
    return preset;
  }
  function buildOptions(status) {
    const opts = { status: status || 'published', viewOnce };
    opts.caption = caption.trim().slice(0, 200);
    opts.captionMode = captionMode;
    if (captionMode === 'free') opts.captionStyle = captionStyle;
     if (mentions.length) {
      opts.mentions = mentions.map((m) => ({ user: m.id, visibility: m.visibility }));
    }
    if (opts.status === 'scheduled') {
      const at = new Date(scheduleLocal);
      if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now() + 30_000) {
        throw new Error('Pick a schedule time at least 30 seconds from now');
      }
      opts.publishAt = at.toISOString();
    }
    return opts;
  }

  return {
    preset,
    setPreset,
    customMode,
    setCustomMode,
    customValue,
    setCustomValue,
    customUnit,
    setCustomUnit,
    allowReplies,
    setAllowReplies,
    viewOnce,
    setViewOnce,
    scheduleMode,
    setScheduleMode,
    scheduleLocal,
    setScheduleLocal,
    caption,
    setCaption,
    captionMode,
    setCaptionMode,
    captionStyle,
    setCaptionStyle,
    mentions,
    setMentions,
    computeTtlMs,
    buildOptions,
    TTL_PRESETS,
  };
}

/** Fullscreen local preview before post/draft/schedule. */
export function StoryLocalPreview({ file, previewUrl, onClose }) {
  const kind = useMemo(() => {
    if (!file?.type) return 'file';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  }, [file]);

  return createPortal(
    <div className="story-local-preview-overlay" onClick={onClose}>
      <div className="story-local-preview" onClick={(e) => e.stopPropagation()}>
        <div className="story-local-preview-top">
          <span>Preview</span>
          <button type="button" onClick={onClose} aria-label="Close preview">
            ×
          </button>
        </div>
        <div className="story-local-preview-media">
          {kind === 'image' && <img src={previewUrl} alt="Status preview" />}
          {kind === 'video' && <video src={previewUrl} controls autoPlay />}
          {kind === 'audio' && <audio src={previewUrl} controls autoPlay />}
          {kind === 'file' && <p className="empty-hint">Preview not available for this file type</p>}
        </div>
        <button type="button" className="story-composer-post" onClick={onClose}>
          Back to edit
        </button>
      </div>
    </div>,
    document.body
  );
}

export function StoryPublishControls({
  opts,
  friends = [],
  mentionCandidates = [],
  busy,
  canSubmit,
  onPreview,
  onDraft,
  onSchedule,
  onPost,
  postLabel = 'Post story',
  busyLabel = 'Encrypting & posting…',
}) {
  return (
    <>
      <div className="story-caption-mode-toggle" role="tablist" aria-label="Caption style">
        <button
          type="button"
          role="tab"
          aria-selected={opts.captionMode === 'fixed'}
          className={opts.captionMode === 'fixed' ? 'active' : ''}
          disabled={busy}
          onClick={() => opts.setCaptionMode('fixed')}
        >
          Fixed caption
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={opts.captionMode === 'free'}
          className={opts.captionMode === 'free' ? 'active' : ''}
          disabled={busy}
          onClick={() => opts.setCaptionMode('free')}
        >
          Free placement
        </button>
      </div>

      {opts.captionMode === 'fixed' ? (
        <div className="story-composer-caption">
          <textarea
            className="story-caption-input"
            value={opts.caption}
            disabled={busy}
            maxLength={200}
            rows={3}
            placeholder="Add a caption…"
            onChange={(e) => opts.setCaption(e.target.value)}
            aria-label="Story caption"
          />
          <span className="story-caption-counter">{opts.caption.length}/200</span>
        </div>
      ) : (
        <p className="story-caption-free-hint">
          Drag the caption directly on the photo above to place it anywhere.
        </p>
      )}

      <div className="story-composer-ttl">
        <p className="story-composer-ttl-label">Visible for</p>
        <div className="story-composer-ttl-presets" role="group" aria-label="Story duration">
          {opts.TTL_PRESETS.map((p) => (
            <button
              key={p.ms}
              type="button"
              className={`story-ttl-preset ${!opts.customMode && opts.preset === p.ms ? 'active' : ''}`}
              disabled={busy}
              onClick={() => {
                opts.setCustomMode(false);
                opts.setPreset(p.ms);
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            className={`story-ttl-preset ${opts.customMode ? 'active' : ''}`}
            disabled={busy}
            onClick={() => opts.setCustomMode(true)}
          >
            Custom…
          </button>
        </div>

        {opts.customMode && (
          <div className="story-composer-custom-row">
            <input
              type="number"
              min="1"
              value={opts.customValue}
              disabled={busy}
              onChange={(e) => opts.setCustomValue(e.target.value)}
              aria-label="Custom duration value"
            />
            <select
              value={opts.customUnit}
              disabled={busy}
              onChange={(e) => opts.setCustomUnit(e.target.value)}
              aria-label="Custom duration unit"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        )}
        <p className="story-composer-ttl-hint">Min 15 minutes · max 7 days. Media is sealed before upload.</p>
      </div>

      <div className="story-composer-options">
        <label className="story-composer-check">
          <input
            type="checkbox"
            checked={opts.allowReplies}
            disabled={busy}
            onChange={(e) => opts.setAllowReplies(e.target.checked)}
          />
          <span>Allow replies to this story</span>
        </label>
        <label className="story-composer-check">
          <input
            type="checkbox"
            checked={opts.viewOnce}
            disabled={busy}
            onChange={(e) => opts.setViewOnce(e.target.checked)}
          />
          <span>View once — disappears for each viewer right after they open it</span>
        </label>
       
      {friends.length > 0 && (
        <StoryMentionPicker
          friends={friends}
          selected={opts.mentions}
          onChange={opts.setMentions}
          disabled={busy}
        />
      )}
        <div className="story-schedule-block">
          <label className="story-composer-check">
            <input
              type="checkbox"
              checked={opts.scheduleMode}
              disabled={busy}
              onChange={(e) => opts.setScheduleMode(e.target.checked)}
            />
            <span>Schedule for later</span>
          </label>
          {opts.scheduleMode && (
            <input
              type="datetime-local"
              className="story-schedule-input"
              value={opts.scheduleLocal}
              disabled={busy}
              onChange={(e) => opts.setScheduleLocal(e.target.value)}
              aria-label="Publish date and time"
            />
          )}
        </div>
      </div>

      <div className="story-composer-actions story-composer-actions-multi">
        {onPreview && (
          <button type="button" className="story-composer-secondary" onClick={onPreview} disabled={busy || !canSubmit}>
            Preview
          </button>
        )}
        <button type="button" className="story-composer-secondary" onClick={onDraft} disabled={busy || !canSubmit}>
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        {opts.scheduleMode ? (
          <button type="button" className="story-composer-post" onClick={onSchedule} disabled={busy || !canSubmit}>
            {busy ? 'Scheduling…' : 'Schedule'}
          </button>
        ) : (
          <button type="button" className="story-composer-post" onClick={onPost} disabled={busy || !canSubmit}>
            {busy ? busyLabel : postLabel}
          </button>
        )}
      </div>
    </>
  );
}
