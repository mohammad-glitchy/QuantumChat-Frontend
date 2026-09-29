import { useEffect, useRef, useState } from 'react';
import { streamQuantumAI } from '../api/aiClient.js';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { buildCapsule, getLocalConsentLog, saveLocalConsentLog } from '../utils/aiCapsule.js';
import {
  AI_BG_STORAGE_KEY,
  AI_BG_THEMES,
  readStoredAiBg,
  writeStoredAiBg,
} from '../utils/aiPanelBg.js';

function messageKey(message, index) {
  return String(message.id || message._id || `idx-${index}`);
}

export default function AIAssistantPanel({ conversation, messages, onClose, onInsertDraft, onSaveEncryptedNote }) {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [contextMode, setContextMode] = useState('none');
  const [selectedContext, setSelectedContext] = useState('');
  const [pickedIds, setPickedIds] = useState(() => new Set());
  const [purpose, setPurpose] = useState('assist');
  const [aiBg, setAiBg] = useState(readStoredAiBg);
  const [lastCapsule, setLastCapsule] = useState(() => {
    const log = getLocalConsentLog(user?.id);
    return log[0] || null;
  });
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const chunkBufferRef = useRef('');
  const rafRef = useRef(null);

  useEffect(() => {
    writeStoredAiBg(aiBg);
  }, [aiBg]);

  useEffect(() => {
    function onStorage(e) {
      if (e.key !== AI_BG_STORAGE_KEY) return;
      const next = readStoredAiBg();
      setAiBg((prev) => (prev === next ? prev : next));
    }
    function onCustom(e) {
      const next = e?.detail;
      if (typeof next === 'string' && AI_BG_THEMES.some((t) => t.id === next)) {
        setAiBg(next);
      }
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener('qc-ai-panel-bg', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('qc-ai-panel-bg', onCustom);
    };
  }, []);

  const pickableMessages = messages.filter((message) => message.text).slice(-20);

  const contextCount = contextMode.startsWith('last-') ? Number(contextMode.slice(5)) : 0;
  let context = [];
  if (contextMode === 'selection' && selectedContext) {
    context = [selectedContext];
  } else if (contextMode === 'pick') {
    context = pickableMessages
      .filter((message, index) => pickedIds.has(messageKey(message, index)))
      .map((message) => message.text);
  } else if (contextCount) {
    context = messages.filter((message) => message.text).slice(-contextCount).map((message) => message.text);
  }

  function togglePick(id) {
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function ask(event) {
    event.preventDefault();
    if (!prompt.trim() || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setAnswer('');
    setBusy(true);
    try {
      if (context.length > 0) {
        const purposeValue = (purpose || 'assist').trim().slice(0, 200) || 'assist';
        const { contentHash } = await buildCapsule({
          messagesTexts: context,
          purpose: purposeValue,
        });
        const receiptMeta = {
          contentHash,
          messageCount: context.length,
          purpose: purposeValue,
          conversationType: conversation?.type || '',
          conversationId: conversation?.id != null ? String(conversation.id) : '',
          createdAt: new Date().toISOString(),
        };
        try {
          await client.post('/users/me/ai-capsules', {
            contentHash: receiptMeta.contentHash,
            messageCount: receiptMeta.messageCount,
            purpose: receiptMeta.purpose,
            conversationType: receiptMeta.conversationType,
            conversationId: receiptMeta.conversationId || undefined,
          });
        } catch {
          // Receipt upload is best-effort; local consent log still records the capsule.
        }
        if (user?.id) {
          saveLocalConsentLog(user.id, receiptMeta);
          setLastCapsule(receiptMeta);
        }
      }

      await streamQuantumAI({
        message: prompt.trim(),
        context,
        ephemeral: true,
        // Receipts must be signed for the logged-in QuantumChat user id.
        // conversation.id is the peer/group — never use that as quantumChatPeerId.
        link:
          conversation?.type === 'group'
            ? { groupId: conversation.id, quantumChatPeerId: user?.id }
            : { quantumChatPeerId: user?.id },
        signal: controller.signal,
        onChunk: (chunk) => {
          // Buffer chunks and flush via rAF to prevent per-token re-renders
          chunkBufferRef.current += chunk;
          if (!rafRef.current) {
            rafRef.current = requestAnimationFrame(() => {
              setAnswer((current) => current + chunkBufferRef.current);
              chunkBufferRef.current = '';
              rafRef.current = null;
            });
          }
        },
      });
    } finally {
      // Flush any remaining buffered text
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (chunkBufferRef.current) {
        setAnswer((current) => current + chunkBufferRef.current);
        chunkBufferRef.current = '';
      }
      setBusy(false);
      abortRef.current = null;
    }
  }

  const capsuleSnippet = lastCapsule
    ? `Capsule hash: ${String(lastCapsule.contentHash).slice(0, 6)}… · ${lastCapsule.messageCount} msgs · ${lastCapsule.purpose}`
    : null;

  return (
    <aside
      className="quantum-ai-panel"
      data-ai-bg={aiBg}
      aria-label="QuantumAI assistant"
    >
      <header>
        <div>
          <strong>QuantumAI</strong>
          <small>Only sees context you approve</small>
        </div>
        <button type="button" onClick={onClose} aria-label="Close QuantumAI">×</button>
      </header>

      <div className="ai-bg-control">
        <span className="ai-bg-control-label">Background</span>
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
              onClick={() => {
                setAiBg(theme.id);
                window.dispatchEvent(
                  new CustomEvent('qc-ai-panel-bg', { detail: theme.id }),
                );
              }}
            >
              <span className="ai-bg-swatch-name">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="ai-context-control">
        Share context
        <select value={contextMode} onChange={(event) => setContextMode(event.target.value)}>
          <option value="none">Prompt only</option>
          <option value="selection">Selected text</option>
          <option value="pick">Pick messages</option>
          <option value="last-1">Last message</option>
          <option value="last-5">Last 5 messages</option>
          <option value="last-10">Last 10 messages</option>
        </select>
      </label>

      <label className="ai-context-control">
        Purpose
        <input
          type="text"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value)}
          maxLength={200}
          placeholder="assist"
        />
      </label>

      {contextMode === 'selection' && (
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            setSelectedContext(window.getSelection()?.toString().trim() || '');
          }}
        >
          Capture highlighted chat text
        </button>
      )}

      {contextMode === 'pick' && (
        <div className="ai-pick-list" role="group" aria-label="Pick messages for AI context">
          {pickableMessages.length === 0 ? (
            <p className="ai-privacy-preview">No text messages to pick.</p>
          ) : (
            pickableMessages.map((message, index) => {
              const id = messageKey(message, index);
              const preview = String(message.text).slice(0, 80);
              return (
                <label key={id} className="ai-pick-item">
                  <input
                    type="checkbox"
                    checked={pickedIds.has(id)}
                    onChange={() => togglePick(id)}
                  />
                  <span>{preview}{String(message.text).length > 80 ? '…' : ''}</span>
                </label>
              );
            })
          )}
        </div>
      )}

      <p className="ai-privacy-preview">
        Privacy preview:{' '}
        {contextMode === 'selection'
          ? selectedContext
            ? `${selectedContext.length} selected characters`
            : 'no selected text captured'
          : context.length
            ? `${context.length} decrypted message(s)`
            : 'no chat messages'}{' '}
        will be sent.
      </p>

      {capsuleSnippet && <p className="ai-capsule-receipt">{capsuleSnippet}</p>}

      <div className="ai-panel-answer">
        {answer || 'Ask for an explanation, summary, or draft reply.'}
      </div>

      {answer && (
        <div className="ai-answer-actions">
          <button type="button" className="ai-insert-draft" onClick={() => onInsertDraft(answer)}>
            Insert as draft
          </button>
          <button type="button" onClick={() => onSaveEncryptedNote?.(answer)}>
            Save encrypted note
          </button>
        </div>
      )}

      <form onSubmit={ask}>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask QuantumAI…" />
        <button type="submit" disabled={busy || !prompt.trim()}>{busy ? 'Thinking…' : 'Ask'}</button>
        {busy && <button type="button" onClick={() => abortRef.current?.abort()}>Stop</button>}
      </form>
    </aside>
  );
}
