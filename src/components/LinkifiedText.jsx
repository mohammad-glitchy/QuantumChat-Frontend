import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserRound, Download, Copy, X } from 'lucide-react';
import { linkifyText } from '../utils/linkify.js';
import { isSafeHttpUrl } from '../utils/safeUrl.js';
import { lookupContactByPhone } from '../api/client.js';
import UserProfileModal from './UserProfileModal.jsx';

function toHref(url) {
  return url.startsWith('http') ? url : `https://${url}`;
}

function downloadVCard(phone, name = 'Contact') {
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:${phone}\nEND:VCARD`;
  const blob = new Blob([vcard], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/\s+/g, '_') || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function PhoneToken({ phone }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [status, setStatus] = useState('idle'); // idle | loading | found | not_found | error
  const [foundUserId, setFoundUserId] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  function openMenu() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
    setStatus('idle');
  }

  async function handleSearch() {
    setStatus('loading');
    try {
      const res = await lookupContactByPhone(phone);
      if (res?.data?.id) {
        setFoundUserId(res.data.id);
        setStatus('found');
      } else {
        setStatus('not_found');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="linkified-phone"
        onClick={(e) => {
          e.stopPropagation();
          openMenu();
        }}
      >
        {phone}
      </button>

      {open &&
        createPortal(
          <div
            className="linkified-phone-popover"
            style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000 }}
            role="menu"
          >
            <div className="linkified-phone-popover-header">
              <span>{phone}</span>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                <X size={14} />
              </button>
            </div>

            {status === 'found' ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setShowProfile(true);
                }}
              >
                <UserRound size={16} strokeWidth={2} />
                <span>View QuantumChat profile</span>
              </button>
            ) : (
              <button type="button" role="menuitem" onClick={handleSearch} disabled={status === 'loading'}>
                <UserRound size={16} strokeWidth={2} />
                <span>
                  {status === 'loading'
                    ? 'Searching…'
                    : status === 'not_found'
                    ? 'No account found'
                    : status === 'error'
                    ? 'Search failed — retry'
                    : 'Search QuantumChat account'}
                </span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                downloadVCard(phone);
                setOpen(false);
              }}
            >
              <Download size={16} strokeWidth={2} />
              <span>Save to contacts</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigator.clipboard?.writeText(phone);
                setOpen(false);
              }}
            >
              <Copy size={16} strokeWidth={2} />
              <span>Copy number</span>
            </button>
          </div>,
          document.body
        )}

      {showProfile && foundUserId && (
        <UserProfileModal userId={foundUserId} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}

export default function LinkifiedText({ text }) {
  const tokens = linkifyText(text);

  return (
    <>
      {tokens.map((tok, i) => {
        if (tok.type === 'url' && isSafeHttpUrl(toHref(tok.value))) {
          return (
            <a
              key={i}
              href={toHref(tok.value)}
              target="_blank"
              rel="noopener noreferrer"
              className="linkified-url"
              onClick={(e) => e.stopPropagation()}
            >
              {tok.value}
            </a>
          );
        }
        if (tok.type === 'email') {
          return (
            <a
              key={i}
              href={`mailto:${tok.value}`}
              className="linkified-email"
              onClick={(e) => e.stopPropagation()}
            >
              {tok.value}
            </a>
          );
        }
        if (tok.type === 'phone') {
          return <PhoneToken key={i} phone={tok.value} />;
        }
        if (tok.type === 'mention') {
          return (
            <span key={i} className="mention-chip">
              {tok.value}
            </span>
          );
        }
        return <span key={i}>{tok.value}</span>;
      })}
    </>
  );
}