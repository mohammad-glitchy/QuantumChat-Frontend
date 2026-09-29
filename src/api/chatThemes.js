import client from './client.js';

let catalogPromise = null;

// Static catalog (preset combos + individual bubble colors/wallpapers) the
// picker renders from. Cached after the first successful fetch — it rarely
// changes and the theme modal used to re-request it every open.
export async function fetchThemeCatalog() {
  if (!catalogPromise) {
    catalogPromise = client
      .get('/chat-themes/presets')
      .then(({ data }) => data.data)
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

// The caller's saved theme for a specific 1:1 conversation, or the default
// shape ({ bubbleColorId: 'default', wallpaperId: 'none' }) if unset.
export async function fetchChatTheme(peerId) {
  const { data } = await client.get(`/chat-themes/${peerId}`);
  return data.data;
}

// payload is EITHER { presetId } for a top-grid combo, OR
// { bubbleColorId, wallpaperId } for independent "Customize" picks.
export async function saveChatTheme(peerId, payload) {
  const { data } = await client.put(`/chat-themes/${peerId}`, payload);
  return data.data;
}

export async function resetChatTheme(peerId) {
  const { data } = await client.delete(`/chat-themes/${peerId}`);
  return data.data;
}

// Uploads a custom wallpaper image (multipart). Backend sets wallpaperId to
// the 'custom' sentinel and returns the updated theme, same shape as
// saveChatTheme's return value.
export async function uploadWallpaperImage(peerId, file) {
  const form = new FormData();
  form.append('wallpaper', file);
  const { data } = await client.post(`/chat-themes/${peerId}/wallpaper`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

// Fetches the caller's own uploaded wallpaper bytes and returns a local
// object URL for use in an <img>/background-image — same pattern as
// AttachmentBubble's blob fetch, minus the E2E unsealing step (wallpapers
// aren't encrypted, they're a cosmetic personal asset like an avatar).
export async function fetchWallpaperImageUrl(peerId) {
  const res = await client.get(`/chat-themes/${peerId}/wallpaper`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

// Clears only the custom wallpaper, keeping the chosen bubble color.
export async function removeWallpaperImage(peerId) {
  const { data } = await client.delete(`/chat-themes/${peerId}/wallpaper`);
  return data.data;
}



// --- Group variants: same response shapes, scoped to /chat-themes/group/:groupId ---

export async function fetchGroupChatTheme(groupId) {
  const { data } = await client.get(`/chat-themes/group/${groupId}`);
  return data.data;
}

export async function saveGroupChatTheme(groupId, payload) {
  const { data } = await client.put(`/chat-themes/group/${groupId}`, payload);
  return data.data;
}

export async function resetGroupChatTheme(groupId) {
  const { data } = await client.delete(`/chat-themes/group/${groupId}`);
  return data.data;
}

export async function uploadGroupWallpaperImage(groupId, file) {
  const form = new FormData();
  form.append('wallpaper', file);
  const { data } = await client.post(`/chat-themes/group/${groupId}/wallpaper`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function fetchGroupWallpaperImageUrl(groupId) {
  const res = await client.get(`/chat-themes/group/${groupId}/wallpaper`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

export async function removeGroupWallpaperImage(groupId) {
  const { data } = await client.delete(`/chat-themes/group/${groupId}/wallpaper`);
  return data.data;
}