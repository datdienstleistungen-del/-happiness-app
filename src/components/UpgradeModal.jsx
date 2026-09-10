import React from 'react';
import { Sparkles, X, Check, ArrowRight } from 'lucide-react';
import './UpgradeModal.css';

export default function UpgradeModal({ isOpen, onClose }) {
  if (!isOpen) return null;

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
      </div>
    </div>
  );
}
