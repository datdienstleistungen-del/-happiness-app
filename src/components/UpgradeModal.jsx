import React, { useState } from 'react';
import { Sparkles, X, Check, Zap, Shield, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import './UpgradeModal.css';

export default function UpgradeModal({ isOpen, onClose, onBypass }) {
  const { user } = useAuth();
  const [resetting, setResetting] = useState(false);

  if (!isOpen) return null;

  const handleDevReset = async () => {
    if (!user) return;
    setResetting(true);
    try {
      // Temporärer Dev-Bypass: Setzt die Nutzung für heute auf 0 zurück
      await supabase
        .from('nexus_api_usage')
        .update({ requests_today: 0 })
        .eq('user_id', user.id);
      
      if (onBypass) onBypass();
      onClose();
    } catch (err) {
      console.error("Fehler beim Zurücksetzen:", err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="upgrade-modal-overlay">
      <div className="upgrade-modal-backdrop" onClick={onClose} />
      
      <div className="upgrade-modal-content">
        <button className="upgrade-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="upgrade-modal-header">
          <div className="upgrade-modal-icon">
            <Sparkles size={32} />
          </div>
          <h2>Tageslimit erreicht</h2>
          <p>Du hast dein kostenloses Kontingent an KI-Analysen für heute ausgeschöpft. Upgrade auf <strong>NeXus Pro</strong>, um unlimitiert weiterzuarbeiten.</p>
        </div>

        <div className="upgrade-modal-benefits">
          <div className="benefit-item">
            <Check size={18} className="benefit-icon" />
            <span>Unlimitierte Lead-Analysen & Suchen</span>
          </div>
          <div className="benefit-item">
            <Check size={18} className="benefit-icon" />
            <span>Zugriff auf GPT-4 & Opus KI-Modelle</span>
          </div>
          <div className="benefit-item">
            <Check size={18} className="benefit-icon" />
            <span>Priorisierter Premium-Support</span>
          </div>
        </div>

        <div className="upgrade-modal-actions">
          <button className="btn-primary upgrade-btn" onClick={onClose}>
            Upgrade anfragen <ArrowRight size={18} />
          </button>
          
          <button className="btn-secondary waitlist-btn" onClick={onClose}>
            Vielleicht später
          </button>
        </div>

        {/* Temporärer Entwickler-Button - Wird vor Live-Gang entfernt */}
        <div className="upgrade-modal-dev-section">
          <div className="dev-divider">
            <span>Developer Tools (Nur im Testlauf sichtbar)</span>
          </div>
          <button 
            className="dev-bypass-btn" 
            onClick={handleDevReset}
            disabled={resetting}
          >
            <Shield size={14} />
            {resetting ? 'Setze Limit zurück...' : 'Limit für heute zurücksetzen (Bypass)'}
          </button>
        </div>
      </div>
    </div>
  );
}
