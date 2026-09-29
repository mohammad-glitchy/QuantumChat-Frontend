import { useRef, useState } from 'react';

/**
 * Instagram-style draggable caption. Position is stored as % of the
 * preview container (x/y 0-100), so it maps 1:1 onto the real story
 * media at any screen size, in both the composer and the viewer.
 */
export default function StoryCaptionOverlay({ caption, onCaptionChange, style, onStyleChange, editable = true }) {
  const nodeRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function clamp(n) {
    return Math.min(96, Math.max(4, n));
  }

  function pointFromEvent(e, container) {
    const rect = container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100),
    };
  }

  function startDrag(e) {
    if (!editable || !onStyleChange) return;
    const container = nodeRef.current?.parentElement;
    if (!container) return;
    setDragging(true);

    function move(ev) {
      ev.preventDefault();
      onStyleChange({ ...style, ...pointFromEvent(ev, container) });
    }
    function end() {
      setDragging(false);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
  }

  return (
    <div
      ref={nodeRef}
      className={`story-free-caption${dragging ? ' dragging' : ''}${editable ? ' editable' : ''}`}
      style={{
        left: `${style.x}%`,
        top: `${style.y}%`,
        color: style.color,
        background: style.background,
        fontSize: `${style.fontSize}px`,
        textAlign: style.align,
      }}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      {editable ? (
        <textarea
          rows={1}
          maxLength={200}
          value={caption}
          placeholder="Tap to add caption…"
          onChange={(e) => onCaptionChange(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />
      ) : (
        <span>{caption}</span>
      )}
    </div>
  );
}