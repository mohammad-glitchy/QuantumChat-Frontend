import { getToken } from '../crypto/keyStorage.js';

/**
 * QuantumAI API base URL.
 * Dev defaults to local AI backend; production must never fall back to localhost
 * (CSP on chat.quantumlogicslimited.com blocks http://localhost:5001).
 */
function resolveAiApiBase() {
  const fromEnv = String(import.meta.env.VITE_AI_API_URL || '').trim().replace(/\/$/, '');
  if (import.meta.env.DEV) {
    return fromEnv || 'http://localhost:5001/api/v1';
  }
  if (fromEnv && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(fromEnv)) {
    return fromEnv;
  }
  return 'https://ai.quantumlogicslimited.com/api/v1';
}

const AI_API_BASE = resolveAiApiBase();

function headers(json = false) {
  const token = getToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function jsonRequest(path) {
  const response = await fetch(`${AI_API_BASE}${path}`, { headers: headers() });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `QuantumAI request failed (${response.status})`);
  return body.data;
}

export async function getLatestQuantumAIThread() {
  const data = await jsonRequest('/conversations?archived=false&limit=1');
  const conversation = data.conversations?.[0];
  if (!conversation) return { conversationId: null, messages: [] };
  const detail = await jsonRequest(`/conversations/${conversation._id}`);
  return {
    conversationId: conversation._id,
    messages: (detail.messages || []).map((message) => ({
      id: message._id,
      fromQuantumAI: message.role === 'assistant',
      text: message.content,
      createdAt: message.createdAt,
      quantumAI: true,
    })),
  };
}

export async function streamQuantumAI({
  message,
  conversationId,
  context,
  link,
  signal,
  onStart,
  onChunk,
  onDone,
  ephemeral = false,
}) {
  let response;
  try {
    response = await fetch(`${AI_API_BASE}/ai/chat`, {
      method: 'POST',
      headers: headers(true),
      signal,
      body: JSON.stringify({
        message,
        conversationId: conversationId || undefined,
        explicitContext: context?.length ? context : undefined,
        sourceLink: link,
        ephemeral,
        stream: true,
      }),
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error(
      'Cannot reach QuantumAI — the AI server may be down, or the browser blocked the response (CORS/CORP). Check https://ai.quantumlogicslimited.com/api/v1/health',
    );
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      throw new Error(
        'QuantumAI login failed — JWT_SECRET on the AI server must match QuantumChat (re-login after fixing)',
      );
    }
    if (response.status === 429) {
      throw new Error('QuantumAI rate limit reached — try again in a few minutes');
    }
    if (response.status >= 500) {
      throw new Error(
        body.error ||
          'QuantumAI server error — check GROQ_API_KEY and AI backend logs',
      );
    }
    throw new Error(body.error || `QuantumAI request failed (${response.status})`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('QuantumAI stream is unavailable');
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const events = pending.split('\n\n');
    pending = events.pop() || '';
    for (const block of events) {
      const event = block.match(/^event:\s*(.+)$/m)?.[1];
      const raw = block.match(/^data:\s*(.+)$/m)?.[1];
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (event === 'start') onStart?.(data.conversationId);
      if (event === 'chunk') onChunk?.(data.content || '');
      if (event === 'done') onDone?.(data);
      if (event === 'error') throw new Error(data.message || 'QuantumAI stream failed');
    }
  }
}
