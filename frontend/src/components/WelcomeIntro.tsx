import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface WelcomeIntroProps {
  onComplete: () => void;
}

export const WelcomeIntro: React.FC<WelcomeIntroProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Sequence timelines
    const timers = [
      setTimeout(() => setStep(1), 200),  // SYSTEM INITIALIZING
      setTimeout(() => setStep(2), 400),  // ✦ Icon
      setTimeout(() => setStep(3), 700),  // FUNDSROOM
      setTimeout(() => setStep(4), 1000), // WELCOME TO FUNDSROOM ERP
      setTimeout(() => setStep(5), 1300), // Tagline
      setTimeout(() => setStep(6), 1600), // ENTER WORKSPACE button
      setTimeout(() => {
        // Auto-transition after 3.2 seconds
        handleEnter();
      }, 3500)
    ];

    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const handleEnter = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete();
    }, 400); // match transition speed
  };

  // Support prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setStep(6); // Skip straight to final state
    }
  }, []);

  return (
    <div 
      className={`intro-viewport ${isFadingOut ? 'fade-out' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#F7F8FC',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0F172A',
        zIndex: 99999,
        fontFamily: 'var(--font-sans)',
        padding: '2rem',
        textAlign: 'center',
        overflow: 'hidden'
      }}
    >
      {/* ── Technical grid backdrop ─────────────────────────────────────
          Dark navy lines on white — same system as global body grid.
          z-index 0, behind blobs (z-1) and content (z-2).
      ───────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backgroundImage: [
            'linear-gradient(rgba(160, 170, 195, 0.035) 1px, transparent 1px)',
            'linear-gradient(90deg, rgba(160, 170, 195, 0.035) 1px, transparent 1px)',
            'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(91,92,235,0.045) 0%, transparent 65%)',
            'radial-gradient(ellipse 50% 40% at 0% 0%, rgba(91,92,235,0.03) 0%, transparent 55%)',
            'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 52%, rgba(247,248,252,0.8) 100%)',
          ].join(', '),
          backgroundSize: [
            '36px 36px',
            '36px 36px',
            '100% 100%',
            '100% 100%',
            '100% 100%',
          ].join(', '),
        }}
      />

      <div className="glass-blob blob-1"></div>
      <div className="glass-blob blob-2"></div>
      <div className="glass-blob blob-3"></div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', maxWidth: '600px', position: 'relative', zIndex: 2 }}>
        
        {/* Step 1: System Initializing */}
        <span 
          className={`intro-item step-1 ${step >= 1 ? 'visible' : ''}`}
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.2em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase'
          }}
        >
          SYSTEM INITIALIZING
        </span>

        {/* Step 2 & 3: Brand Mark & Name */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', margin: '1.5rem 0' }}>
          <span 
            className={`intro-item step-2 ${step >= 2 ? 'visible' : ''}`}
            style={{
              fontSize: '2.5rem',
              color: 'var(--accent-primary)',
              lineHeight: 1,
              animation: 'pulse-slow 2s infinite'
            }}
          >
            ✦
          </span>
          <h1 
            className={`intro-item step-3 ${step >= 3 ? 'visible' : ''}`}
            style={{
              fontSize: '3rem',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.05em',
              color: 'var(--text-primary)'
            }}
          >
            FUNDSROOM
          </h1>
        </div>

        {/* Step 4: Welcome Message */}
        <h2 
          className={`intro-item step-4 ${step >= 4 ? 'visible' : ''}`}
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-display)'
          }}
        >
          WELCOME TO FUNDSROOM ERP
        </h2>

        {/* Step 5: Tagline */}
        <p 
          className={`intro-item step-5 ${step >= 5 ? 'visible' : ''}`}
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6
          }}
        >
          Your operations.<br />
          <span style={{ color: 'var(--text-secondary)' }}>Connected. Intelligent. In control.</span>
        </p>

        {/* Step 6: Enter Button */}
        <div style={{ height: '60px', marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button 
            className={`intro-item step-6 btn btn-primary ${step >= 6 ? 'visible' : ''}`}
            onClick={handleEnter}
            style={{
              opacity: 0,
              pointerEvents: step >= 6 ? 'auto' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.8rem 2rem',
              background: 'linear-gradient(135deg, var(--accent-primary), #4f46e5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 20px rgba(99, 102, 241, 0.25), 0 0 0 1px rgba(99, 102, 241, 0.1)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <span>ENTER WORKSPACE</span>
            <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
};
