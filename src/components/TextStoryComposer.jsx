import { useEffect, useMemo, useState } from 'react';
import {
  StoryLocalPreview,
  StoryPublishControls,
  useStoryPublishOptions,
} from './StoryPublishControls.jsx';

const MAX_CHARS = 700;

const BACKGROUNDS = [
  { id: 'midnight', label: 'Midnight', fill: '#0b1020' },
  { id: 'ocean', label: 'Ocean', fill: '#0d47a1' },
  { id: 'forest', label: 'Forest', fill: '#1b5e20' },
  { id: 'ember', label: 'Ember', fill: '#b71c1c' },
  { id: 'plum', label: 'Plum', fill: '#4a148c' },
  { id: 'sand', label: 'Sand', fill: '#5d4037' },
  { id: 'slate', label: 'Slate', fill: '#37474f' },
  { id: 'rose', label: 'Rose', fill: '#ad1457' },
  {
    id: 'aurora',
    label: 'Aurora',
    fill: { type: 'linear', colors: ['#0f2027', '#203a43', '#2c5364'] },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    fill: { type: 'linear', colors: ['#ff512f', '#dd2476'] },
  },
  {
    id: 'mint',
    label: 'Mint',
    fill: { type: 'linear', colors: ['#11998e', '#38ef7d'] },
  },
  {
    id: 'gold',
    label: 'Gold',
    fill: { type: 'linear', colors: ['#f7971e', '#ffd200'] },
  },
];

const FONTS = [
  { id: 'classic', label: 'Classic', family: 'system-ui, Segoe UI, sans-serif', weight: 600 },
  { id: 'modern', label: 'Modern', family: 'Georgia, "Times New Roman", serif', weight: 500 },
  { id: 'bold', label: 'Bold', family: 'Impact, Haettenschweiler, sans-serif', weight: 700 },
  { id: 'typewriter', label: 'Type', family: '"Courier New", Courier, monospace', weight: 600 },
  { id: 'script', label: 'Script', family: 'Georgia, "Palatino Linotype", cursive', weight: 500 },
];

const ALIGNS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

function cssBackground(fill) {
  if (typeof fill === 'string') return fill;
  if (fill?.type === 'linear' && Array.isArray(fill.colors)) {
    return `linear-gradient(160deg, ${fill.colors.join(', ')})`;
  }
  return '#0b1020';
}

function paintFill(ctx, fill, w, h) {
  if (typeof fill === 'string') {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  if (fill?.type === 'linear' && Array.isArray(fill.colors) && fill.colors.length) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const last = fill.colors.length - 1;
    fill.colors.forEach((c, i) => grad.addColorStop(last === 0 ? 0 : i / last, c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, w, h);
}

function wrapLines(ctx, text, maxWidth) {
  const paragraphs = String(text || '').split('\n');
  const lines = [];
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
        } else {
          // Hard-break very long tokens
          let chunk = '';
          for (const ch of word) {
            const tryChunk = chunk + ch;
            if (ctx.measureText(tryChunk).width <= maxWidth) chunk = tryChunk;
            else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          line = chunk;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [''];
}

/** Render styled text status to a compressed JPEG (posts as a sealed image story). */
export async function renderTextStoryToFile(text, { backgroundId, fontId, align }) {
  const bg = BACKGROUNDS.find((b) => b.id === backgroundId) || BACKGROUNDS[0];
  const font = FONTS.find((f) => f.id === fontId) || FONTS[0];
  const textAlign = ['left', 'center', 'right'].includes(align) ? align : 'center';

  // 720×1280 JPEG keeps sealed download/decrypt snappy vs a full-bleed PNG.
  const W = 720;
  const H = 1280;
  const padX = 56;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  paintFill(ctx, bg.fill, W, H);

  const raw = String(text || '').trim().slice(0, MAX_CHARS);
  let fontSize = raw.length > 220 ? 36 : raw.length > 120 ? 44 : raw.length > 60 ? 54 : 64;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = `${font.weight} ${fontSize}px ${font.family}`;

  let lines = wrapLines(ctx, raw, W - padX * 2);
  while (lines.length * fontSize * 1.25 > H * 0.72 && fontSize > 28) {
    fontSize -= 2;
    ctx.font = `${font.weight} ${fontSize}px ${font.family}`;
    lines = wrapLines(ctx, raw, W - padX * 2);
  }

  const lineHeight = fontSize * 1.28;
  const blockH = lines.length * lineHeight;
  let y = (H - blockH) / 2 + lineHeight / 2;
  ctx.textAlign = textAlign;
  const x = textAlign === 'left' ? padX : textAlign === 'right' ? W - padX : W / 2;

  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not render text status'))),
      'image/jpeg',
      0.82
    );
  });
  return new File([blob], `text-status-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

export default function TextStoryComposer({ friends = [], onCancel, onConfirm, uploading, onError }) {
  const [text, setText] = useState('');
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [fontId, setFontId] = useState(FONTS[0].id);
  const [align, setAlign] = useState('center');
  const [rendering, setRendering] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const opts = useStoryPublishOptions();

  const bg = useMemo(
    () => BACKGROUNDS.find((b) => b.id === backgroundId) || BACKGROUNDS[0],
    [backgroundId]
  );
  const font = useMemo(() => FONTS.find((f) => f.id === fontId) || FONTS[0], [fontId]);
  const busy = uploading || rendering;
  const canPost = text.trim().length > 0 && !busy;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onCancel?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function submit(status) {
    if (!canPost) return;
    setRendering(true);
    try {
      const options = opts.buildOptions(status);
      const file = await renderTextStoryToFile(text, { backgroundId, fontId, align });
      await onConfirm?.(file, opts.computeTtlMs(), opts.allowReplies, options);
    } catch (err) {
      onError?.(err?.message || 'Could not create text status');
    } finally {
      setRendering(false);
    }
  }

  async function handlePreview() {
    if (!text.trim()) return;
    setRendering(true);
    try {
      const file = await renderTextStoryToFile(text, { backgroundId, fontId, align });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      onError?.(err?.message || 'Could not preview text status');
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="story-composer-overlay text-story-overlay" onClick={busy ? undefined : onCancel}>
      <div className="text-story-composer" onClick={(e) => e.stopPropagation()}>
        <div className="story-composer-top">
          <span>Text status</span>
          <button type="button" onClick={onCancel} disabled={busy} aria-label="Cancel">
            ×
          </button>
        </div>

        <div
          className="text-story-canvas"
          style={{
            background: cssBackground(bg.fill),
            fontFamily: font.family,
            fontWeight: font.weight,
            textAlign: align,
          }}
        >
          <textarea
            className="text-story-input"
            value={text}
            maxLength={MAX_CHARS}
            disabled={busy}
            placeholder="Type a status…"
            aria-label="Status text"
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>

        <div className="text-story-options">
          <p className="story-composer-ttl-label">Background</p>
          <div className="text-story-swatches" role="group" aria-label="Background">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`text-story-swatch${backgroundId === b.id ? ' active' : ''}`}
                style={{ background: cssBackground(b.fill) }}
                title={b.label}
                aria-label={b.label}
                disabled={busy}
                onClick={() => setBackgroundId(b.id)}
              />
            ))}
          </div>

          <p className="story-composer-ttl-label">Font</p>
          <div className="text-story-chip-row" role="group" aria-label="Font style">
            {FONTS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`text-story-chip${fontId === f.id ? ' active' : ''}`}
                style={{ fontFamily: f.family, fontWeight: f.weight }}
                disabled={busy}
                onClick={() => setFontId(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="story-composer-ttl-label">Align</p>
          <div className="text-story-chip-row" role="group" aria-label="Text alignment">
            {ALIGNS.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`text-story-chip${align === a.id ? ' active' : ''}`}
                disabled={busy}
                onClick={() => setAlign(a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>

          <p className="text-story-charcount">
            {text.length}/{MAX_CHARS}
          </p>
        </div>

        <StoryPublishControls
          opts={opts}
          friends={friends}
          busy={busy}
          canSubmit={canPost}
          onPreview={handlePreview}
          onDraft={() => submit('draft')}
          onSchedule={() => submit('scheduled')}
          onPost={() => submit('published')}
          postLabel="Post status"
        />
      </div>
      {previewFile && previewUrl && (
        <StoryLocalPreview
          file={previewFile}
          previewUrl={previewUrl}
          onClose={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            setPreviewFile(null);
          }}
        />
      )}
    </div>
  );
}
