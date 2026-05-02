import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, AnimatePresence } from 'framer-motion';
import AirlineLogo from './AirlineLogo';
import EventIcon from './EventIcon';
import { METARIcon } from './METARIcon';

export interface ManifestCardData {
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
  metar?: string;
  narrative: string;
  isNew?: boolean;
  registration?: string;
  callsign?: string;
  occurrenceCategory?: string[];
}

interface ManifestStackProps {
  incidents: ManifestCardData[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

const ManifestStack: React.FC<ManifestStackProps> = ({ incidents, selectedId, setSelectedId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);
  const [maxScroll, setMaxScroll] = useState(0);

  const cards = incidents || [];
  const selectedCard = cards.find(c => c.id === selectedId);

  useEffect(() => {
    const updateScrollLimit = () => {
      if (scrollRef.current && containerRef.current) {
        const limit = containerRef.current.offsetHeight - scrollRef.current.scrollHeight;
        setMaxScroll(Math.min(0, limit));
      }
    };
    
    updateScrollLimit();
    window.addEventListener('resize', updateScrollLimit);
    return () => window.removeEventListener('resize', updateScrollLimit);
  }, [cards]);

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
        height: isFocused ? 'auto' : '350px',
        ...(isFocused ? { zIndex: 1001, minHeight: '600px' } : {})
      }}
      onClick={(e) => {
        if (!isFocused) {
          e.stopPropagation();
          setSelectedId(card.id);
        }
      }}
    >
      <div className="scanline"></div>
      
      <div className="shipping-grid">
        {/* Row 1: AIRCRAFT TYPE | OPERATOR | AIRLINE LOGO */}
        <div className="shipping-section header">
           <div className="shipping-box-title" style={{ flexGrow: 1, fontSize: '0.9rem', fontWeight: 100, letterSpacing: '0.15em', fontFamily: 'Outfit, sans-serif', display: 'flex', alignItems: 'center', gap: '12px' }}>
             <span>{card.aircraft_type || card.aircraft}</span>
             <span style={{ opacity: 0.3 }}>/</span>
             <span style={{ fontWeight: 500, fontSize: '0.75rem', opacity: 0.8 }}>{card.operator}</span>
           </div>
           <div className="shipping-status-icons" style={{ background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
             <AirlineLogo operator={card.operator} size={36} />
           </div>
        </div>

        {/* Row 2: DATE (RED) */}
        <div className="shipping-section shipping-date-bar">
           {card.date}
        </div>

        {/* Row 3: METAR ICON | SECTOR OPS */}
        <div className="shipping-section shipping-middle-grid">
           <div className="shipping-icon-cell">
              <METARIcon 
                condition={card.metar?.split(' ').find(s => s.includes('BKN') || s.includes('OVC') || s.includes('FEW') || s.includes('SCT') || s.includes('SKC') || s.includes('RA') || s.includes('TS')) || 'CAVOK'} 
                size={isFocused ? 48 : 32} 
              />
           </div>
           <div className="shipping-content-cell">
              <div className="shipping-label">SECTOR CODES</div>
              <div className="shipping-sector-codes" style={{ fontSize: isFocused ? '3.5rem' : '2.4rem' }}>
                {card.departure} » {card.arrival}
              </div>
           </div>
        </div>

        {/* Row 4: INCIDENT CLASSIFICATION TAGS */}
        <div className="shipping-section shipping-data-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
           {(card.occurrenceCategory || []).map(tag => (
             <span key={tag} style={{ 
               fontSize: '0.8rem', 
               fontWeight: 900, 
               background: 'var(--theme-color)', 
               padding: '2px 8px',
               color: 'white',
               letterSpacing: '0.1em'
             }}>
               {tag}
             </span>
           ))}
           {(!card.occurrenceCategory || card.occurrenceCategory.length === 0) && (
             <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>NO CLASSIFICATION</span>
           )}
        </div>

        {/* Narrative (Only when focused) */}
        {isFocused && (
          <div style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem', opacity: 0.8, lineHeight: 1.6 }}>
             <div className="shipping-label" style={{ marginBottom: '12px', fontSize: '0.7rem' }}>INCIDENT NARRATIVE</div>
             {card.narrative}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <div 
        ref={containerRef}
        className="grid-mask-container"
        style={{ position: 'relative' }}
      >
        <motion.div 
          ref={scrollRef}
          className="grid-scroll-container"
          style={{ y: dragY }}
        >
          {cards.map((card) => (
            <React.Fragment key={card.id}>
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
