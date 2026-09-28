import { Children, isValidElement } from 'react';
import useVisualViewport from '../../hooks/useVisualViewport.js';
import ResizableDivider from './ResizableDivider.jsx';

/**
 * Outer chat chrome — neutral shell that theme skins paint over.
 */
export default function ChatShell({
  children,
  className = '',
  threadOpen = false,
  infoOpen = false,
  aiOpen = false,
}) {
  useVisualViewport(true);

  const classes = [
    'chat-page',
    'qc-shell',
    threadOpen ? 'qc-shell--thread-open' : '',
    infoOpen ? 'qc-shell--info-open' : '',
    aiOpen ? 'qc-shell--ai-open' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Insert the resize handle between the first child (sidebar) and the
  // rest (chat-main, etc.) without touching how those children are built.
  const childArray = Children.toArray(children).filter(isValidElement);
  const [sidebarChild, ...restChildren] = childArray;

  return (
    <div className={classes}>
      {sidebarChild}
      {sidebarChild && restChildren.length > 0 && <ResizableDivider />}
      {restChildren}
    </div>
  );
}