import { useEffect, useRef, useState } from 'react';
import {
  fetchThemeCatalog,
  fetchWallpaperImageUrl,
  removeWallpaperImage,
  resetChatTheme,
  saveChatTheme,
  uploadWallpaperImage,
  fetchGroupWallpaperImageUrl,
  removeGroupWallpaperImage,
  resetGroupChatTheme,
  saveGroupChatTheme,
  uploadGroupWallpaperImage,
} from '../api/chatThemes.js';
import { getWallpaperThumbnail, preloadWallpaper } from '../theme/wallpaperBackgrounds.js';

const MAX_WALLPAPER_BYTES = 10 * 1024 * 1024;

// Pass EITHER `peerId` (1:1 DM) OR `groupId` (group chat) — never both.
// Everything else is identical; this is a personal display preference, so
// each group member picks their own bubble/wallpaper independently, same
// as DMs.
export default function ChatThemeModal({ peerId, groupId, theme, catalog: catalogProp, onApplied, onClose }) {
  const isGroup = Boolean(groupId);
  const scopeId = groupId || peerId;

  const [catalog, setCatalog] = useState(catalogProp || null);
  const [customizing, setCustomizing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (catalogProp) {
      setCatalog(catalogProp);
      return;
    }
    let cancelled = false;
    fetchThemeCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load theme options');
      });
    return () => {
      cancelled = true;
    };
  }, [catalogProp]);

  useEffect(() => {
    if (theme.wallpaperId !== 'custom') {
      setCustomWallpaperUrl(null);
      return;
    }
    let cancelled = false;
    let urlToRevoke = null;
    const fetchUrl = isGroup ? fetchGroupWallpaperImageUrl : fetchWallpaperImageUrl;
    fetchUrl(scopeId).then((url) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      urlToRevoke = url;
      setCustomWallpaperUrl(url);
    });
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [scopeId, isGroup, theme.wallpaperId, theme.updatedAt]);

  async function applyPreset(presetId) {
    setSaving(true);
    setError('');
    try {
      const preset = catalog?.presets?.find((p) => p.id === presetId);
      if (preset?.wallpaperId) preloadWallpaper(preset.wallpaperId);
      const save = isGroup ? saveGroupChatTheme : saveChatTheme;
      const updated = await save(scopeId, { presetId });
      onApplied(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply theme');
    } finally {
      setSaving(false);
    }
  }

  async function applyCustom(nextBubbleColorId, nextWallpaperId) {
    setSaving(true);
    setError('');
    try {
      const payload = {};
      if (nextBubbleColorId != null) payload.bubbleColorId = nextBubbleColorId;
      if (nextWallpaperId != null) {
        payload.wallpaperId = nextWallpaperId;
        preloadWallpaper(nextWallpaperId);
      }
      const save = isGroup ? saveGroupChatTheme : saveChatTheme;
      const updated = await save(scopeId, payload);
      onApplied(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply theme');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError('');
    try {
      const reset = isGroup ? resetGroupChatTheme : resetChatTheme;
      const updated = await reset(scopeId);
      onApplied(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset theme');
    } finally {
      setSaving(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file');
      return;
    }
    if (file.size > MAX_WALLPAPER_BYTES) {
      setError('Image is too large (max 10MB)');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const upload = isGroup ? uploadGroupWallpaperImage : uploadWallpaperImage;
      const updated = await upload(scopeId, file);
      onApplied(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload wallpaper');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveWallpaper() {
    setSaving(true);
    setError('');
    try {
      const remove = isGroup ? removeGroupWallpaperImage : removeWallpaperImage;
      const updated = await remove(scopeId);
      onApplied(updated);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove wallpaper');
    } finally {
      setSaving(false);
    }
  }

  if (!catalog) {
    return (
      <div className="theme-modal-backdrop" onClick={onClose}>
        <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
          <p className="empty-hint">Loading theme options…</p>
        </div>
      </div>
    );
  }

  const currentBubble = catalog.bubbleColors.find((b) => b.id === theme.bubbleColorId);

  return (
    <div className="theme-modal-backdrop" onClick={onClose}>
      <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
        <div className="theme-modal-header">
          <span>{isGroup ? 'Group chat theme' : 'Chat theme'}</span>
          <button className="link-button" onClick={onClose}>
            Close
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <p className="theme-section-label">Themes</p>
        <div className="theme-preset-grid">
          {catalog.presets.map((preset) => {
            const bubble = catalog.bubbleColors.find((b) => b.id === preset.bubbleColorId);
            const active = theme.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                className={`theme-preset-tile ${active ? 'active' : ''}`}
                style={{ background: getWallpaperThumbnail(preset.wallpaperId) }}
                onClick={() => applyPreset(preset.id)}
                onMouseEnter={() => preloadWallpaper(preset.wallpaperId)}
                onFocus={() => preloadWallpaper(preset.wallpaperId)}
                disabled={saving}
                title={preset.name}
              >
                <span className="theme-preset-swatch" style={{ background: bubble?.mine }} />
              </button>
            );
          })}
        </div>
        <p className="theme-hint">
          {isGroup
            ? 'This changes how the group looks for you only — other members keep their own theme.'
            : 'The chat bubble and wallpaper will both change.'}
        </p>

        <p className="theme-section-label">Customize</p>
        <button
          type="button"
          className="theme-customize-row"
          onClick={() => setCustomizing(customizing === 'bubble' ? null : 'bubble')}
        >
          <span>Chat bubble</span>
          <span className="theme-preset-swatch small" style={{ background: currentBubble?.mine }} />
        </button>
        {customizing === 'bubble' && (
          <div className="theme-swatch-grid">
            {catalog.bubbleColors.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`theme-swatch ${theme.bubbleColorId === b.id ? 'active' : ''}`}
                style={{ background: b.mine }}
                title={b.name}
                disabled={saving}
                onClick={() => applyCustom(b.id, null)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          className="theme-customize-row"
          onClick={() => setCustomizing(customizing === 'wallpaper' ? null : 'wallpaper')}
        >
          <span>Wallpaper</span>
          <span
            className="theme-preset-swatch small"
            style={
              theme.wallpaperId === 'custom' && customWallpaperUrl
                ? { backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover' }
                : { background: getWallpaperThumbnail(theme.wallpaperId) }
            }
          />
        </button>
        {customizing === 'wallpaper' && (
          <>
            <div className="theme-swatch-grid">
              {catalog.wallpapers.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`theme-swatch ${theme.wallpaperId === w.id ? 'active' : ''}`}
                  style={{ background: getWallpaperThumbnail(w.id) }}
                  title={w.name}
                  disabled={saving}
                  onMouseEnter={() => preloadWallpaper(w.id)}
                  onFocus={() => preloadWallpaper(w.id)}
                  onClick={() => applyCustom(null, w.id)}
                />
              ))}
              {theme.wallpaperId === 'custom' && customWallpaperUrl && (
                <button
                  type="button"
                  className="theme-swatch active"
                  style={{ backgroundImage: `url(${customWallpaperUrl})`, backgroundSize: 'cover' }}
                  title="Your uploaded wallpaper"
                  disabled
                />
              )}
              <button
                type="button"
                className="theme-swatch theme-swatch-upload"
                title="Upload your own"
                disabled={saving}
                onClick={handleUploadClick}
              >
                +
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {theme.wallpaperId === 'custom' && (
              <button
                type="button"
                className="link-button theme-remove-wallpaper-button"
                onClick={handleRemoveWallpaper}
                disabled={saving}
              >
                Remove uploaded wallpaper
              </button>
            )}
          </>
        )}

        <button type="button" className="link-button theme-reset-button" onClick={handleReset} disabled={saving}>
          Reset to default
        </button>
      </div>
    </div>
  );
}