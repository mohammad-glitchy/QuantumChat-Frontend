import client from './client.js';

function stripJsonContentType(headers) {
  if (headers) delete headers['Content-Type'];
}

export async function listHighlights(userId) {
  const { data } = await client.get('/highlights', {
    params: userId ? { userId } : undefined,
  });
  return data.data || [];
}

export async function getHighlight(id) {
  const { data } = await client.get(`/highlights/${id}`);
  return data.data;
}

export async function createHighlight({ name, coverFile }) {
  const form = new FormData();
  form.append('name', name);
  if (coverFile) form.append('cover', coverFile);
  const { data } = await client.post('/highlights', form, {
    transformRequest: [(body, headers) => {
      if (body instanceof FormData) stripJsonContentType(headers);
      return body;
    }],
  });
  return data.data;
}

export async function updateHighlight(id, { name, coverFile } = {}) {
  const form = new FormData();
  if (name != null) form.append('name', name);
  if (coverFile) form.append('cover', coverFile);
  const { data } = await client.patch(`/highlights/${id}`, form, {
    transformRequest: [(body, headers) => {
      if (body instanceof FormData) stripJsonContentType(headers);
      return body;
    }],
  });
  return data.data;
}

export async function addHighlightItem({ highlightId, file, sourceStoryId, caption, durationMs, mediaType }) {
  const form = new FormData();
  form.append('file', file);
  if (sourceStoryId) form.append('sourceStoryId', String(sourceStoryId));
  if (caption) form.append('caption', caption);
  if (durationMs != null) form.append('durationMs', String(durationMs));
  if (mediaType) form.append('mediaType', mediaType);
  const { data } = await client.post(`/highlights/${highlightId}/items`, form, {
    transformRequest: [(body, headers) => {
      if (body instanceof FormData) stripJsonContentType(headers);
      return body;
    }],
  });
  return data.data;
}

export async function deleteHighlight(id) {
  const { data } = await client.delete(`/highlights/${id}`);
  return data.data;
}

export async function deleteHighlightItem(highlightId, itemId) {
  const { data } = await client.delete(`/highlights/${highlightId}/items/${itemId}`);
  return data.data;
}

export async function fetchHighlightCoverBlob(highlightId) {
  const { data } = await client.get(`/highlights/${highlightId}/cover`, { responseType: 'blob' });
  return data;
}

export async function fetchHighlightItemMediaBlob(highlightId, itemId) {
  const { data } = await client.get(`/highlights/${highlightId}/items/${itemId}/media`, { responseType: 'blob' });
  return data;
}