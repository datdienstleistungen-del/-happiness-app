import React from 'react';
import { X, Check, ArrowRight, Zap, Crown, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './UpgradeModal.css';

const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay';

const TIERS = [
  {
    id: 'pro',
    name: 'NeXus Pro',
    price: '49 €',
    period: '/Monat',
    limit: '100 Leads/Monat',
    icon: Zap,
    priceId: import.meta.env.VITE_STRIPE_PRICE_PRO || 'price_1UDy532LYA3KKe2WcHmMXgAJ',
    features: ['100 Leads pro Monat', 'KI-Coach & Pitch-Generierung', 'Lead Radar & Trigger', 'E-Mail-Support'],
    color: '#10B981',
  },
  {
    id: 'enterprise',
    name: 'NeXus Enterprise',
    price: '232 €',
    period: '/Monat',
    limit: '500 Leads/Monat',
    icon: Crown,
    priceId: import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE || 'price_1UDy7D2LYA3KKe2WOChePnhU',
    features: ['500 Leads pro Monat', 'Alles aus Pro', 'Priority Support', 'API-Zugang', 'Individuelle Integration'],
    color: '#8B5CF6',
  },
];

export default function UpgradeModal({ isOpen, onClose }) {
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleUpgrade = (priceId) => {
    const url = `${STRIPE_CHECKOUT_URL}/${priceId}?client_reference_id=${user?.id || ''}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="upgrade-modal-overlay">
      <div className="upgrade-modal-backdrop" onClick={onClose} />
      
      <div className="upgrade-modal-content upgrade-modal-tiers">
        <button className="upgrade-modal-close" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="upgrade-modal-header">
          <div className="upgrade-modal-icon">
            <Zap size={32} />
          </div>
          <h2>Lead-Limit erreicht</h2>
          <p>Du hast dein kostenloses Kontingent aufgebraucht. Upgrade für mehr Leads.</p>
        </div>

        <div className="upgrade-tiers-grid">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <div key={tier.id} className="upgrade-tier-card" style={{ '--tier-color': tier.color }}>
                <div className="tier-header">
                  <Icon size={24} />
                  <h3>{tier.name}</h3>
                  <div className="tier-price">
                    <span className="price-amount">{tier.price}</span>
                    <span className="price-period">{tier.period}</span>
                  </div>
                  <span className="tier-limit">{tier.limit}</span>
                </div>
                <ul className="tier-features">
                  {tier.features.map((f, i) => (
                    <li key={i}><Check size={14} /> {f}</li>
                  ))}
                </ul>
                <button 
                  className="tier-btn" 
                  style={{ backgroundColor: tier.color }}
                  onClick={() => handleUpgrade(tier.priceId)}
                >
                  Jetzt upgraden <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <button className="btn-secondary waitlist-btn" onClick={onClose}>
          Vielleicht später
        </button>
      </div>
    </div>
  );
}
