import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  FileKey2,
  Lock,
  Menu,
  MessageSquare,
  Paperclip,
  ScanLine,
  Shield,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  {
    icon: Lock,
    title: 'Client-side encryption',
    copy: 'Keys are generated and used only in your browser. The server never sees private keys or plaintext.',
  },
  {
    icon: FileKey2,
    title: 'Portable key backups',
    copy: 'Export a simple keys.txt file to restore your keyring on another device — recovery stays in your hands.',
  },
  {
    icon: Zap,
    title: 'Realtime delivery',
    copy: 'Messages travel over WebSockets for instant chat, then decrypt locally against your key pool.',
  },
  {
    icon: Paperclip,
    title: 'Encrypted attachments',
    copy: 'Files, images, and voice notes are sealed like text. The server only stores ciphertext bytes.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    copy: 'Register with a username and email. Credentials identify you — they never unlock your messages.',
  },
  {
    step: '02',
    title: 'Save your keyring',
    copy: 'We generate five Curve25519 key pairs in-browser. Download keys.txt and keep it somewhere safe.',
  },
  {
    step: '03',
    title: 'Start chatting',
    copy: 'Open a conversation. Outgoing messages are sealed before they leave your device; incoming decrypt locally.',
  },
];

export default function Landing() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (user) {
    return <Navigate to="/chat" replace />;
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="landing-page">
      <div className="landing-aurora" aria-hidden="true" />

      <header className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand" aria-label="QuantumChat home">
            <span className="landing-brand-mark">
              <BrandLogo size={36} />
            </span>
            <span className="landing-brand-text">
              Quantum<span>Chat</span>
            </span>
          </Link>

          <nav className="landing-nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#security">Security</a>
          </nav>

          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link to="/login" className="landing-link-btn">
              Sign in
            </Link>
            <Link to="/register" className="landing-btn landing-btn-primary">
              Get started
            </Link>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="landing-drawer"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.22 }}
          >
            <a href="#features" onClick={closeMenu}>
              Features
            </a>
            <a href="#how-it-works" onClick={closeMenu}>
              How it works
            </a>
            <a href="#security" onClick={closeMenu}>
              Security
            </a>
            <div className="landing-drawer-cta">
              <Link to="/login" className="landing-btn landing-btn-ghost" onClick={closeMenu}>
                Sign in
              </Link>
              <Link to="/register" className="landing-btn landing-btn-primary" onClick={closeMenu}>
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-glow" aria-hidden="true" />
          <div className="landing-hero-inner">
            <motion.p
              className="landing-brand-hero"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <BrandLogo className="landing-brand-hero-logo" size={56} />
              QuantumChat
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05 }}
            >
              Private messaging that stays on your device
            </motion.h1>
            <motion.p
              className="landing-hero-copy"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              End-to-end sealed with X25519 and NaCl box encryption. Your keys never leave the browser —
              even we can&apos;t read your chats.
            </motion.p>
            <motion.div
              className="landing-hero-cta"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
            >
              <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
                Start encrypted chat
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-lg">
                Sign in
              </Link>
              <Link to="/link-device?scan=1" className="landing-btn landing-btn-ghost landing-btn-lg">
                <ScanLine size={18} aria-hidden="true" />
                Scan QR Code
              </Link>
            </motion.div>
            <motion.div
              className="landing-hero-preview"
              aria-hidden="true"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
            >
              <div className="landing-preview-shell">
                <div className="landing-preview-sidebar">
                  <span className="landing-preview-pill" />
                  <span className="landing-preview-pill short" />
                  <span className="landing-preview-pill" />
                </div>
                <div className="landing-preview-chat">
                  <div className="landing-preview-bubble theirs">Keys stay on device</div>
                  <div className="landing-preview-bubble mine">Sealed before send</div>
                  <div className="landing-preview-composer">
                    <Sparkles size={14} />
                    <span>Encrypted message…</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="features" className="landing-section">
          <div className="landing-section-inner">
            <div className="landing-section-head">
              <p className="landing-eyebrow">Features</p>
              <h2>Built for cryptographic sovereignty</h2>
              <p>One calm product surface — messaging that feels premium without exposing your content.</p>
            </div>
            <div className="landing-feature-grid">
              {FEATURES.map(({ icon: Icon, title, copy }) => (
                <article key={title} className="landing-feature">
                  <div className="landing-feature-icon">
                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section landing-section-alt">
          <div className="landing-section-inner">
            <div className="landing-section-head">
              <p className="landing-eyebrow">How it works</p>
              <h2>Ready in three quiet steps</h2>
              <p>No plugins. No key servers. Just your browser and a backup file.</p>
            </div>
            <div className="landing-steps">
              {STEPS.map((item) => (
                <article key={item.step} className="landing-step">
                  <span className="landing-step-num">{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="landing-section">
          <div className="landing-section-inner landing-security">
            <div className="landing-section-head left">
              <p className="landing-eyebrow">Security</p>
              <h2>Zero-trust by default</h2>
              <p>
                QuantumChat uses TweetNaCl <code>nacl.box</code> — authenticated encryption with ephemeral
                Curve25519, Salsa20, and Poly1305. Every DM is double-enveloped for you and your peer.
              </p>
            </div>
            <ul className="landing-security-list">
              <li>
                <MessageSquare size={18} aria-hidden="true" />
                <div>
                  <strong>Double-envelope DMs</strong>
                  <span>Separate sealed payloads for sender and recipient keyrings.</span>
                </div>
              </li>
              <li>
                <FileKey2 size={18} aria-hidden="true" />
                <div>
                  <strong>Password ≠ encryption</strong>
                  <span>Login never decrypts history. Only your keyring can.</span>
                </div>
              </li>
              <li>
                <Shield size={18} aria-hidden="true" />
                <div>
                  <strong>Server sees ciphertext</strong>
                  <span>Attachments and voice notes follow the same sealed path.</span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section className="landing-cta-band">
          <div className="landing-cta-band-inner">
            <h2>Own your conversations</h2>
            <p>Create an account, save your keys, and start a sealed chat in under a minute.</p>
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-lg">
              Get started free
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <Link to="/" className="landing-brand">
              <span className="landing-brand-mark sm">
                <BrandLogo size={28} />
              </span>
              <span className="landing-brand-text">
                Quantum<span>Chat</span>
              </span>
            </Link>
            <p>Open-source E2E messaging focused on keys you control.</p>
          </div>
          <div className="landing-footer-cols">
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#security">Security</a>
              <Link to="/register">Web app</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Register</Link>
            </div>
            <div>
              <h4>References</h4>
              <a href="https://tweetnacl.js.org/" target="_blank" rel="noopener noreferrer">
                TweetNaCl
              </a>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Quantum Logics</p>
          <p>End-to-end encrypted by design</p>
        </div>
      </footer>
    </div>
  );
}
