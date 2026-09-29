import { useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'qc-sidebar-width';
const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 328; // matches --sidebar-width default in index.css
const STEP = 16; // keyboard resize step

function clamp(value, containerWidth) {
  const hardMax = Math.min(MAX_WIDTH, Math.round(containerWidth * 0.5));
  return Math.min(hardMax, Math.max(MIN_WIDTH, value));
}

export default function ResizableDivider() {
  const handleRef = useRef(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_WIDTH);
  const shellRef = useRef(null);

  const getShell = useCallback(() => {
    if (!shellRef.current) {
      shellRef.current = handleRef.current?.closest('.qc-shell') || null;
    }
    return shellRef.current;
  }, []);

  // Apply a persisted width on mount, but only if one was actually saved —
  // otherwise leave the CSS variable untouched so responsive defaults
  // (280/328/360px per breakpoint) keep working exactly as before.
  useEffect(() => {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    const shell = getShell();
    if (!shell) return;
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (!saved || Number.isNaN(saved)) return;
    const containerWidth = shell.getBoundingClientRect().width;
    shell.style.setProperty('--sidebar-width', `${clamp(saved, containerWidth)}px`);
  }, [getShell]);

  const applyWidth = useCallback((px) => {
    const shell = getShell();
    if (!shell) return;
    const containerWidth = shell.getBoundingClientRect().width;
    const next = clamp(px, containerWidth);
    shell.style.setProperty('--sidebar-width', `${next}px`);
    return next;
  }, [getShell]);

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const delta = clientX - startXRef.current;
    applyWidth(startWidthRef.current + delta);
  }, [applyWidth]);

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    handleRef.current?.classList.remove('is-dragging');

    const shell = getShell();
    if (shell) {
      const current = getComputedStyle(shell).getPropertyValue('--sidebar-width').trim();
      const px = parseInt(current, 10);
      if (px) localStorage.setItem(STORAGE_KEY, String(px));
    }

    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
  }, [getShell, onPointerMove]);

  const startDrag = useCallback((clientX) => {
    if (window.matchMedia('(max-width: 768px)').matches) return; // mobile: sidebar is an overlay, resizing doesn't apply
    const shell = getShell();
    if (!shell) return;

    const sidebarEl = shell.querySelector('.sidebar');
    const currentWidth = sidebarEl
      ? sidebarEl.getBoundingClientRect().width
      : DEFAULT_WIDTH;

    draggingRef.current = true;
    startXRef.current = clientX;
    startWidthRef.current = currentWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    handleRef.current?.classList.add('is-dragging');

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }, [getShell, onPointerMove, onPointerUp]);

  function handleMouseDown(e) {
    e.preventDefault();
    startDrag(e.clientX);
  }

  function handleTouchStart(e) {
    startDrag(e.touches[0].clientX);
  }

  function handleDoubleClick() {
    // Reset to default width
    const shell = getShell();
    if (!shell) return;
    shell.style.setProperty('--sidebar-width', `${DEFAULT_WIDTH}px`);
    localStorage.removeItem(STORAGE_KEY);
  }

  function handleKeyDown(e) {
    const shell = getShell();
    if (!shell) return;
    const current = getComputedStyle(shell).getPropertyValue('--sidebar-width').trim();
    const px = parseInt(current, 10) || DEFAULT_WIDTH;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = applyWidth(px - STEP);
      if (next) localStorage.setItem(STORAGE_KEY, String(next));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = applyWidth(px + STEP);
      if (next) localStorage.setItem(STORAGE_KEY, String(next));
    } else if (e.key === 'Home' || e.key === 'Enter') {
      e.preventDefault();
      handleDoubleClick();
    }
  }

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div
      ref={handleRef}
      className="qc-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <span className="qc-resize-handle-grip" aria-hidden="true" />
    </div>
  );
}