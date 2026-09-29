import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { connectSocket, getSocket } from '../api/socket.js';
import { saveSession } from '../crypto/keyStorage.js';
import QrCodeScanner from '../components/QrCodeScanner.jsx';
import {
  claimDeviceLinkSession,
  parseQrPayload,
  pollDeviceLinkStatus,
  sendDeviceLinkEmail,
  verifyDeviceLink,
} from '../api/deviceLink.js';

function getDeviceLabel() {
  if (typeof navigator === 'undefined') return 'This device';
  return String(navigator.userAgent || '').slice(0, 120) || 'This device';
}

export default function LinkDevicePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, updateSessionUser } = useAuth();
  const [linkState, setLinkState] = useState('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [linkId, setLinkId] = useState('');
  const [token, setToken] = useState('');
  const [statusText, setStatusText] = useState('Scan the QR code shown on your existing device to continue.');
  const [payloadText, setPayloadText] = useState('');
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [hasKeys, setHasKeys] = useState(true);
  const pollTimerRef = useRef(null);
  const pollingRef = useRef(false);
  const claimingRef = useRef(false);
  const verificationRef = useRef(false);

  useEffect(() => {
    if (searchParams.get('scan') === '1') setScannerOpen(true);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      pollingRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const localKeys = localStorage.getItem(`qc_keyring_${user.id}`);
    setHasKeys(Boolean(localKeys));
  }, [user]);

  const stopPolling = () => {
    if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
    pollingRef.current = false;
  };

  const finishLogin = (result) => {
    if (!result?.token) throw new Error('No session credentials were returned.');
    saveSession(result.token, result.user, result.sessionId);
    updateSessionUser(result.user);
    connectSocket();
    navigate('/chat', { replace: true });
  };

  const claimSession = async (nextLinkId, nextToken) => {
    if (claimingRef.current) return;
    claimingRef.current = true;
    stopPolling();
    setStatusText('Approval received. Signing you in…');
    try {
      const result = await claimDeviceLinkSession({ linkId: nextLinkId, token: nextToken });
      finishLogin(result);
    } catch {
      claimingRef.current = false;
      setLinkState('idle');
      setError('The device was approved but the session could not be claimed.');
    }
  };

  const startPolling = (nextLinkId, nextToken) => {
    stopPolling();
    pollingRef.current = true;
    const poll = async () => {
      if (!pollingRef.current) return;
      try {
        const result = await pollDeviceLinkStatus({ linkId: nextLinkId, token: nextToken });
        if (result?.status === 'verified') {
          setStatusText('Device detected. Waiting for approval from your existing device…');
        }
        if (result?.status === 'used' && result?.token) {
          stopPolling();
          finishLogin(result);
          return;
        }
        if (result?.status === 'rejected') {
          stopPolling();
          setLinkState('rejected');
          setStatusText('The request was rejected.');
          setError('');
          return;
        }
        if (result?.status === 'expired') {
          stopPolling();
          setLinkState('expired');
          setStatusText('The pairing link expired.');
          return;
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 403) {
          stopPolling();
          setLinkState('rejected');
          setStatusText('The request was rejected on your existing device.');
          setError('');
          return;
        }
        if (status === 410 || String(err?.message || '').includes('410')) {
          stopPolling();
          setLinkState('expired');
          setStatusText('The pairing link expired.');
          return;
        }
      }
      if (pollingRef.current) pollTimerRef.current = window.setTimeout(poll, 2000);
    };
    pollTimerRef.current = window.setTimeout(poll, 1500);
  };

  const verifyPayload = async (rawPayload) => {
    if (verificationRef.current) return;
    const parsed = parseQrPayload(rawPayload);
    if (!parsed) {
      setError('This does not appear to be a valid QuantumChat device-link QR code.');
      setLinkState('idle');
      return;
    }
    verificationRef.current = true;
    setScannerOpen(false);
    setLoading(true);
    setError('');
    setStatusText('Verifying the link request…');
    try {
      await verifyDeviceLink({
        linkId: parsed.linkId,
        token: parsed.token,
        deviceLabel: getDeviceLabel(),
        deviceInfo: { userAgent: navigator.userAgent, ip: '' },
      });
      setLinkId(parsed.linkId);
      setToken(parsed.token);
      setLinkState('waiting');
      setStatusText('Device detected. Waiting for approval from your existing device…');
      startPolling(parsed.linkId, parsed.token);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to verify the link request.');
      setLinkState('idle');
    } finally {
      verificationRef.current = false;
      setLoading(false);
    }
  };

  const handleManualImport = async () => {
    if (!payloadText) {
      setError('Paste the QR payload or link URL first.');
      return;
    }
    await verifyPayload(payloadText);
  };

  const handleEmailSend = async () => {
    if (!linkId || !token) {
      setError('Create a pairing request first.');
      return;
    }
    const [emailLocalPart, emailDomain] = email.split('@');
    if (!emailLocalPart || !emailDomain?.includes('.')) {
      setError('Enter a valid email address.');
      return;
    }
    setEmailBusy(true);
    setEmailMessage('');
    try {
      const result = await sendDeviceLinkEmail({ linkId, token });
      setEmailMessage(result?.message || 'Pairing link sent.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Unable to send the pairing link.');
    } finally {
      setEmailBusy(false);
    }
  };

  useEffect(() => {
    if (!linkId || !token) return;
    const socket = getSocket();
    if (!socket) {
      connectSocket();
      return;
    }
    const handleApproved = ({ linkId: approvedLinkId }) => {
      if (approvedLinkId !== linkId) return;
      void claimSession(linkId, token);
    };
    const handleRejected = ({ linkId: rejectedLinkId }) => {
      if (rejectedLinkId !== linkId) return;
      setLinkState('rejected');
      setStatusText('The request was rejected.');
      setError('');
    };
    socket.on('device:link-approved', handleApproved);
    socket.on('device:link-rejected', handleRejected);
    return () => {
      socket.off('device:link-approved', handleApproved);
      socket.off('device:link-rejected', handleRejected);
    };
  }, [linkId, token, navigate, updateSessionUser]);

  return (
    <div className="settings-modal" style={{ position: 'relative', maxWidth: 760, margin: '24px auto', overflowY: 'auto', maxHeight: 'calc(100vh - 48px)' }}>
      <div className="settings-modal-header">
        <div className="settings-modal-heading">
          <h2>Link a new device</h2>
          <p>Use this page on the device you want to connect. Scan the QR code or paste the payload from the existing device.</p>
        </div>
      </div>
      <div className="settings-section" style={{ padding: 24 }}>
        {!hasKeys && (
          <div className="settings-fieldset" style={{ marginBottom: 16 }}>
            <h3 className="settings-section-title">Encryption keys</h3>
            <p className="settings-section-copy">
              This device does not currently have your encryption keys. Import your existing keys backup before continuing.
            </p>
          </div>
        )}
        <div className="settings-fieldset" style={{ marginBottom: 16 }}>
          <h3 className="settings-section-title">Pairing</h3>
          <p className="settings-section-copy">{statusText}</p>
          {error ? <p className="settings-section-copy" style={{ color: 'var(--danger)' }}>{error}</p> : null}
          <div className="settings-key-actions" style={{ marginTop: 12 }}>
            <button type="button" className="settings-btn primary" onClick={() => { setError(''); setScannerOpen(true); }} disabled={loading || linkState === 'waiting'}>
              Scan QR code
            </button>
            <button type="button" className="settings-btn ghost" onClick={() => { stopPolling(); setLinkState('idle'); setError(''); setStatusText('Scan the QR code shown on your existing device to continue.'); }}>
              Cancel
            </button>
          </div>
        </div>

        {scannerOpen ? (
          <QrCodeScanner
            onDetected={verifyPayload}
            onError={(message) => { setScannerOpen(false); setError(message); }}
            onCancel={() => setScannerOpen(false)}
          />
        ) : null}

        <div className="settings-fieldset" style={{ marginBottom: 16 }}>
          <h3 className="settings-section-title">Paste QR payload</h3>
          <label className="settings-field">
            <span>QR payload or link URL</span>
            <textarea value={payloadText} onChange={(event) => setPayloadText(event.target.value)} rows={4} placeholder="Paste the JSON payload or link URL from the pairing screen" />
          </label>
          <button type="button" className="settings-btn primary" onClick={handleManualImport} disabled={loading}>
            {loading ? 'Verifying…' : 'Continue'}
          </button>
        </div>

        <div className="settings-fieldset">
          <h3 className="settings-section-title">Can’t scan the QR code?</h3>
          <p className="settings-section-copy">Send a link by email instead.</p>
          <label className="settings-field">
            <span>Email address</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <div className="settings-key-actions">
            <button type="button" className="settings-btn ghost" onClick={handleEmailSend} disabled={emailBusy || !linkId || !token}>
              {emailBusy ? 'Sending…' : 'Send link by email'}
            </button>
          </div>
          {emailMessage ? <p className="settings-section-copy" style={{ color: 'var(--success)' }}>{emailMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
