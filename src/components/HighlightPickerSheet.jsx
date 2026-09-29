import { BookmarkPlus, Check, ImagePlus, Loader2, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addHighlightItem, createHighlight, fetchHighlightCoverBlob, listHighlights } from '../api/highlights.js';

function guessMime(story, blob) {
  if (blob?.type && blob.type !== 'application/octet-stream') return blob.type;
  if (story?.mimetype && story.mimetype !== 'application/octet-stream') return story.mimetype;
  if (story?.mediaType === 'video') return 'video/mp4';
  if (story?.mediaType === 'audio') return 'audio/mp4';
  return 'image/jpeg';
}

function guessExt(mime, mediaType) {
  if (mime.includes('png')) return '.png';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.startsWith('video/') || mediaType === 'video') return '.mp4';
  if (mime.startsWith('audio/') || mediaType === 'audio') return '.m4a';
  return '.jpg';
}

function HighlightThumb({ highlight }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    if (highlight.hasCover) {
      fetchHighlightCoverBlob(highlight.id)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [highlight.id, highlight.hasCover]);

  return (
    <span className="hl-sheet-thumb" aria-hidden>
      {url ? <img src={url} alt="" /> : <BookmarkPlus size={18} />}
    </span>
  );
}

export default function HighlightPickerSheet({ open, onClose, onError, onSaved, mediaUrl, mediaBlob, story }) {
  const [highlights, setHighlights] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCoverFile, setNewCoverFile] = useState(null);
  const [newCoverPreview, setNewCoverPreview] = useState(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setSavingId(null);
    setSavedId(null);
    setError('');
    setCreating(false);
    setNewName('');
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setLoadingList(true);
    listHighlights()
      .then((list) => setHighlights(list))
      .catch(() => setHighlights([]))
      .finally(() => setLoadingList(false));

    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  async function resolveBlob() {
    if (mediaBlob instanceof Blob && mediaBlob.size > 0) return mediaBlob;
    if (!mediaUrl) throw new Error('Story media is still loading — wait a moment and try again');
    const res = await fetch(mediaUrl);
    if (!res.ok) throw new Error('Could not read story media');
    const blob = await res.blob();
    if (!blob.size) throw new Error('Story media is empty');
    return blob;
  }

  async function saveInto(highlightId) {
    if (savingId || !story) return;
    setError('');
    setSavingId(highlightId);
    try {
      const blob = await resolveBlob();
      const mime = guessMime(story, blob);
      const ext = guessExt(mime, story.mediaType);
      const file = new File([blob], `highlight-${highlightId}-${Date.now()}${ext}`, { type: mime });

      await addHighlightItem({
        highlightId,
        file,
        sourceStoryId: story.id,
        caption: story.caption || '',
        durationMs: story.durationMs || 0,
        mediaType: story.mediaType === 'text' ? 'image' : story.mediaType || 'image',
      });

      setSavedId(highlightId);
      setHighlights((prev) =>
        prev.map((h) => (h.id === highlightId ? { ...h, itemCount: (h.itemCount || 0) + 1 } : h))
      );
      onSaved?.(highlightId);
      setTimeout(() => onClose?.(), 650);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not save to highlight';
      setError(msg);
      onError?.(msg);
    } finally {
      setSavingId(null);
    }
  }

  function handleCoverChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
    setNewCoverFile(file);
    setNewCoverPreview(URL.createObjectURL(file));
  }

  async function createAndSave() {
    const name = newName.trim();
    if (!name || savingId) return;
    setError('');
    setSavingId('__new__');
    try {
      const highlight = await createHighlight({ name, coverFile: newCoverFile });
      setHighlights((prev) => [highlight, ...prev]);
      setCreating(false);
      setNewName('');
      if (newCoverPreview) URL.revokeObjectURL(newCoverPreview);
      setNewCoverFile(null);
      setNewCoverPreview(null);
      await saveInto(highlight.id);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Could not create highlight';
      setError(msg);
      onError?.(msg);
      setSavingId(null);
    }
  }

  const canSave = Boolean(mediaBlob || mediaUrl);

  return createPortal(
    <div className="hl-sheet-overlay" onClick={onClose}>
      <div className="hl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="hl-sheet-handle" aria-hidden />
        <div className="hl-sheet-header">
          <div className="hl-sheet-icon">
            <BookmarkPlus size={20} aria-hidden />
          </div>
          <div>
            <h2>Save to highlight</h2>
            <p>Keep this story on your profile forever</p>
          </div>
        </div>

        {error ? <p className="hl-sheet-error" role="alert">{error}</p> : null}
        {!canSave ? (
          <p className="hl-sheet-error" role="status">Wait for the story to finish loading, then try again.</p>
        ) : null}

        {creating ? (
          <div className="hl-sheet-create">
            <button
              type="button"
              className="hl-sheet-cover-picker"
              onClick={() => coverInputRef.current?.click()}
              aria-label="Choose cover image"
            >
              {newCoverPreview ? <img src={newCoverPreview} alt="" /> : <ImagePlus size={22} aria-hidden />}
            </button>
            <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
            <input
              type="text"
              className="hl-sheet-name-input"
              placeholder="Highlight name"
              maxLength={40}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="hl-sheet-create-actions">
              <button type="button" onClick={() => setCreating(false)} disabled={savingId === '__new__'}>
                Cancel
              </button>
              <button
                type="button"
                className="hl-sheet-create-confirm"
                onClick={createAndSave}
                disabled={!newName.trim() || savingId === '__new__' || !canSave}
              >
                {savingId === '__new__' ? <Loader2 size={14} className="hl-spin" aria-hidden /> : 'Create & save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="hl-sheet-grid" role="list">
            <button
              type="button"
              className="hl-sheet-card hl-sheet-card-new"
              onClick={() => setCreating(true)}
              disabled={Boolean(savingId)}
              role="listitem"
            >
              <span className="hl-sheet-emoji" aria-hidden>
                <Plus size={20} />
              </span>
              <span className="hl-sheet-label">New highlight</span>
            </button>

            {loadingList && <p className="empty-hint">Loading your highlights…</p>}
            {!loadingList && highlights.length === 0 && (
              <p className="empty-hint">You don't have any highlights yet — create one above.</p>
            )}

            {highlights.map((h) => {
              const busy = savingId === h.id;
              const justSaved = savedId === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={`hl-sheet-card${justSaved ? ' saved' : ''}${busy ? ' busy' : ''}`}
                  disabled={Boolean(savingId) || !canSave}
                  onClick={() => saveInto(h.id)}
                  role="listitem"
                >
                  <HighlightThumb highlight={h} />
                  <span className="hl-sheet-label">{h.name}</span>
                  <span className="hl-sheet-meta">
                    {busy ? (
                      <>
                        <Loader2 size={14} className="hl-spin" aria-hidden /> Saving…
                      </>
                    ) : justSaved ? (
                      <>
                        <Check size={14} aria-hidden /> Saved
                      </>
                    ) : (
                      `${h.itemCount || 0} saved`
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" className="hl-sheet-cancel" onClick={onClose} disabled={Boolean(savingId)}>
          {creating ? '' : 'Cancel'}
        </button>
      </div>
    </div>,
    document.body
  );
}