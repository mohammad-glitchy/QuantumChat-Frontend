import { useMemo, useRef, useState } from 'react';

export default function StoryMentionPicker({ friends, selected, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const blurTimer = useRef(null);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pickedIds = new Set(selected.map((s) => s.id));
    return (friends || [])
      .filter((f) => !pickedIds.has(f.id))
      .filter((f) => !q || f.username?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [friends, selected, query]);

  function addMention(f) {
    onChange([...selected, { id: f.id, username: f.username, visibility: 'public' }]);
    setQuery('');
    setOpen(false);
  }

  function removeMention(id) {
    onChange(selected.filter((m) => m.id !== id));
  }

  function setVisibility(id, visibility) {
    onChange(selected.map((m) => (m.id === id ? { ...m, visibility } : m)));
  }

  function handleFocus() {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setOpen(true);
  }

  function handleBlur() {
    // Delay closing so a click on a suggestion below registers before the
    // dropdown disappears (a plain onBlur would fire first and hide it).
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="story-mention-picker">
      <input
        type="text"
        placeholder="Tag a friend…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {open && candidates.length > 0 && (
        <div className="story-mention-suggestions">
          {candidates.map((f) => (
            <button
              type="button"
              key={f.id}
              className="story-mention-suggestion-row"
              onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur's timer doesn't race the click
              onClick={() => addMention(f)}
            >
              @{f.username}
            </button>
          ))}
        </div>
      )}
      {open && candidates.length === 0 && (friends || []).length > 0 && (
        <div className="story-mention-suggestions story-mention-empty">
          {query ? 'No matching friends' : "You've tagged everyone available"}
        </div>
      )}

      {selected.length > 0 && (
        <div className="story-mention-chips">
          {selected.map((m) => (
            <div key={m.id} className="story-mention-chip">
              <span className="story-mention-chip-name">@{m.username}</span>
              <div className="story-mention-visibility-toggle">
                <button
                  type="button"
                  className={m.visibility === 'public' ? 'is-active' : ''}
                  onClick={() => setVisibility(m.id, 'public')}
                >
                  👁 Public
                </button>
                <button
                  type="button"
                  className={m.visibility === 'hidden' ? 'is-active' : ''}
                  onClick={() => setVisibility(m.id, 'hidden')}
                >
                  🔒 Hidden
                </button>
              </div>
              <button type="button" className="story-mention-remove" onClick={() => removeMention(m.id)} title="Remove tag">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}