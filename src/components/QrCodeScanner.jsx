import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

function prefersRearCamera() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || navigator.userAgentData?.mobile === true;
}

export default function QrCodeScanner({ onDetected, onError, onCancel }) {
  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const detectedRef = useRef(false);
  const callbacksRef = useRef({ onDetected, onError });
  const [starting, setStarting] = useState(true);

  callbacksRef.current = { onDetected, onError };

  useEffect(() => {
    let cancelled = false;
    let scanner;

    async function startScanner() {
      if (!videoRef.current) return;
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        callbacksRef.current.onError?.('Camera access requires HTTPS or localhost. A camera cannot be used from an insecure HTTP network address.');
        return;
      }

      try {
        const hasCamera = await QrScanner.hasCamera();
        if (!hasCamera) {
          callbacksRef.current.onError?.('No camera was found on this device.');
          return;
        }
        if (cancelled) return;

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            scanner.stop();
            callbacksRef.current.onDetected?.(result?.data || result);
          },
          {
            preferredCamera: prefersRearCamera() ? 'environment' : 'user',
            returnDetailedScanResult: true,
            highlightScanRegion: false,
            highlightCodeOutline: true,
          }
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!cancelled) setStarting(false);
      } catch (error) {
        if (!cancelled) {
          callbacksRef.current.onError?.(error?.name === 'NotAllowedError' ? 'Camera permission was denied.' : 'Unable to start the camera.');
        }
      }
    }

    startScanner();
    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, []);

  return (
    <dialog open className="device-link-scanner" aria-labelledby="device-link-scanner-title">
      <div className="device-link-scanner-card">
        <div className="device-link-scanner-header">
          <div>
            <h2 id="device-link-scanner-title">Scan QR Code</h2>
            <p>Point your camera at the QR code shown on your other device.</p>
          </div>
          <button type="button" className="settings-btn ghost" onClick={onCancel} aria-label="Close scanner">
            Close
          </button>
        </div>
        <div className="device-link-scanner-viewport">
          <video ref={videoRef} muted playsInline aria-label="QR code camera preview" />
          <span className="device-link-scanner-frame" aria-hidden="true" />
          {starting ? <span className="device-link-scanner-status">Starting camera…</span> : null}
        </div>
        <p className="settings-section-copy">Your camera stays active only while this scanner is open.</p>
      </div>
    </dialog>
  );
}
