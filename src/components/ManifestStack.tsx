import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import AirlineLogo from './AirlineLogo';
import EventIcon from './EventIcon';

interface ManifestCardData {
  id: string;
  source_id?: string;
  operator: string;
  aircraft: string;
  aircraft_type?: string;
  departure: string;
  arrival: string;
  status: string;
  theme: string;
  time: string;
  date?: string;
  narrative: string;
  isNew?: boolean;
  severity?: string;
  source?: string;
  url?: string;
  metar?: string;
  icao?: string;
  last_updated?: string;
  occurrenceCategory?: string[];
  occurrenceClass?: string;
}

interface ManifestStackProps {
  cards: ManifestCardData[];
}

const ManifestStack: React.FC<ManifestStackProps> = ({ cards }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dragY = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCard = cards.find(c => c.id === selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [maxScroll, setMaxScroll] = useState(0);

  // Dynamic Scroll Calculation
  useEffect(() => {
    const updateScroll = () => {
      if (containerRef.current && scrollRef.current) {
        const containerH = containerRef.current.offsetHeight;
        const contentH = scrollRef.current.scrollHeight;
        
        // Ensure we can scroll through all content
        const newMaxScroll = Math.min(0, containerH - contentH);
        setMaxScroll(newMaxScroll);

        // Clamp current scroll position if it exceeds new bounds
        const currentY = dragY.get();
        if (currentY < newMaxScroll) {
          dragY.set(newMaxScroll);
        }
      }
    };

    // Initial calculation and observer for content changes
    updateScroll();
    
    // Resize listener for responsive height changes
    window.addEventListener('resize', updateScroll);
    
    // Small delay to ensure layout is settled
    const timer = setTimeout(updateScroll, 100);

    return () => {
      window.removeEventListener('resize', updateScroll);
      clearTimeout(timer);
    };
  }, [cards, dragY]);

  // Handle Wheel/Touchpad Scrolling
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (selectedId) return; // Don't scroll when card is focused
      
      const currentY = dragY.get();
      const newY = Math.min(0, Math.max(maxScroll, currentY - e.deltaY));
      dragY.set(newY);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) container.removeEventListener('wheel', handleWheel);
    };
  }, [selectedId, maxScroll, dragY]);

  const renderCardContent = (card: ManifestCardData, isFocused: boolean) => (
    <motion.div
      layoutId={`card-${card.id}`}
      className={`manifest-card ${card.theme} ${isFocused ? 'focused-card' : ''}`}
      style={{ 
        zIndex: card.id === selectedId ? 999 : 1,
        // Ensure focused card in overlay is even higher
        ...(isFocused ? { zIndex: 1001 } : {})
      }}
      onClick={(e) => {
        if (!isFocused) {
          e.stopPropagation();
          setSelectedId(card.id);
        }
      }}
    >
      <div className="scanline"></div>
      
      {/* Header: Compact 50px Height with Icons */}
      <div className="manifest-header" style={{ 
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px'
      }}>
        <EventIcon status={card.status} size={20} />
        <div style={{ 
          fontSize: isFocused ? '18px' : '14px', 
          fontWeight: 500, // Reduced from 900
          color: 'white', 
          opacity: 0.9,
          textAlign: 'center',
          flex: 1
        }}>
          {card.aircraft_type || card.aircraft}
        </div>
      </div>

      {/* Grid Content: Adaptive */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flexGrow: 1, 
        padding: isFocused ? '24px' : '12px', 
        paddingBottom: '60px', // Reserved space for the 50px absolute footer + gap
        gap: isFocused ? '12px' : '6px',
        alignItems: 'flex-start',
        position: 'relative'
      }}>
        
        {/* Date of Event: Enhanced Scale */}
        <div style={{ 
          fontSize: isFocused ? '16px' : '10px', 
          fontWeight: 300, 
          color: 'white', 
          opacity: 0.6, // Slightly increased opacity for better contrast at larger size
          letterSpacing: '0.05em',
          marginBottom: '2px'
        }}>
          {card.date}
        </div>

        {/* Sector Codes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isFocused ? '16px' : '8px' }}>
          <div className="ticket-code" style={{ fontSize: isFocused ? '2.8rem' : '1.2rem' }}>{card.departure}</div>
          <div style={{ color: 'var(--theme-color)', fontSize: isFocused ? '1.8rem' : '0.8rem' }}>»</div>
          <div className="ticket-code" style={{ fontSize: isFocused ? '2.8rem' : '1.2rem' }}>{card.arrival}</div>
        </div>

        {/* Operator */}
        <div style={{ marginTop: isFocused ? '8px' : '4px', marginBottom: '12px' }}>
          <div className="manifest-label" style={{ fontSize: isFocused ? '0.7rem' : '0.4rem', marginBottom: '11px', color: 'white', opacity: 0.5 }}>Operator</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AirlineLogo operator={card.operator} size={isFocused ? 26 : 18} />
            <div style={{ fontSize: isFocused ? '1.1rem' : '0.65rem', fontWeight: 700, color: 'white' }}>
              {card.operator}
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div style={{ 
          fontSize: isFocused ? '1rem' : '10px',
          fontWeight: 100,
          color: 'white', 
          opacity: 0.8, 
          lineHeight: '1.4', 
          maxHeight: isFocused ? '300px' : '60px', // Reduced to 60px to fit in 320px card
          overflow: 'hidden',
          margin: '4px 0',
          marginBottom: '50px' // Added 50px gap after description
        }}>
          {card.narrative}
        </div>

        {/* Event Descriptors: Outlined Lozenges */}
        {card.occurrenceCategory && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '6px', 
            marginTop: 'auto', 
            marginBottom: '50px', // Maintained 50px gap after lozenges
            paddingBottom: '2px'
          }}>
            {card.occurrenceCategory.map((cat, idx) => (
              <div key={idx} style={{
                fontSize: isFocused ? '0.7rem' : '0.45rem',
                padding: isFocused ? '4px 12px' : '2px 8px',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                color: 'white',
                opacity: 0.8,
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.05em'
              }}>
                {cat}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Core: Base Anchor */}
      <div style={{ 
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '50px',
        background: 'var(--rose-red-dark)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          fontSize: '0.9rem', 
          fontWeight: 900, 
          color: 'white', 
          letterSpacing: '0.2em',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          opacity: 0.9,
          zIndex: 100
        }}>
          {card.status}
        </div>
      </div>

      <div className="reflective-shine">
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <radialGradient id="topperGradient" cx="100%" cy="0%" r="100%" fx="100%" fy="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0.2" />
              <stop offset="85%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path 
            d="M 0 0 L 100 0 L 100 100 A 250 250 0 0 0 0 0 Z" 
            fill="url(#topperGradient)" 
          />
        </svg>
      </div>
    </motion.div>
  );

  return (
    <>
      <div 
        ref={containerRef}
        className="grid-mask-container" 
        style={{ 
          opacity: selectedId ? 0.3 : 1, 
          transition: 'opacity 0.4s',
          pointerEvents: selectedId ? 'none' : 'all' 
        }}
      >
        <motion.div 
          ref={scrollRef}
          className="grid-scroll-container"
          drag={selectedId ? false : "y"}
          whileDrag={{ cursor: 'grabbing' }}
          dragConstraints={{ top: maxScroll, bottom: 0 }}
          style={{ y: dragY }}
        >
          {cards.map((card) => (
            <React.Fragment key={`frag-${card.id}`}>
              {renderCardContent(card, false)}
            </React.Fragment>
          ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedId && selectedCard && (
          <motion.div 
            className="focused-card-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedId(null)}
          >
            {renderCardContent(selectedCard, true)}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ManifestStack;
