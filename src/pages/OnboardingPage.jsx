import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'
import './OnboardingPage.css'

export default function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  const choose = async (choice) => {
    setSaving(true)
    try {
      localStorage.setItem('happiness-onboarding-done', 'true')
      await supabase.from('profiles').update({
        onboarding_completed: true,
        onboarding_choice: choice,
        last_seen: new Date().toISOString()
      }).eq('id', user.id)

      if (choice === 'community') navigate('/today-question', { replace: true })
      else if (choice === 'creator') navigate('/creator-welcome', { replace: true })
      else navigate('/ai-chat', { replace: true })
    } catch (err) {
      console.error('Onboarding save failed:', err)
      if (choice === 'community') navigate('/today-question', { replace: true })
      else if (choice === 'creator') navigate('/creator-welcome', { replace: true })
      else navigate('/ai-chat', { replace: true })
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-center">
        <div className="onboarding-logo">
          <img src="/favicon.svg" alt="H" style={{ width: 40, height: 40 }} />
          <Logo />
        </div>

        <h1 className="onboarding-title">Welcome to Happiness</h1>
        <p className="onboarding-subtitle">
          A community where people grow together.
        </p>
        <p className="onboarding-choose">
          Choose what brought you here today.
        </p>

        <div className="onboarding-cards">
          <button className="onboarding-card" onClick={() => choose('community')} disabled={saving}>
            <span className="onboarding-card-icon">🌍</span>
            <span className="onboarding-card-title">I want to connect with people</span>
            <span className="onboarding-card-desc">
              Meet new people, join discussions and become part of a positive community.
            </span>
            <span className="onboarding-card-btn">Enter Community</span>
          </button>

          <button className="onboarding-card" onClick={() => choose('creator')} disabled={saving}>
            <span className="onboarding-card-icon">🚀</span>
            <span className="onboarding-card-title">I am a Creator</span>
            <span className="onboarding-card-desc">
              Join the New Creator Generation.<br />
              Improve your content. Learn. Grow.<br />
              Build your audience.
            </span>
            <span className="onboarding-card-btn">Enter NCG Academy</span>
          </button>

          <button className="onboarding-card" onClick={() => choose('ai')} disabled={saving}>
            <span className="onboarding-card-icon">🤖</span>
            <span className="onboarding-card-title">I want AI to help me</span>
            <span className="onboarding-card-desc">
              Use Happiness AI for ideas, writing, learning and creativity.
            </span>
            <span className="onboarding-card-btn">Open AI Assistant</span>
          </button>
        </div>
      </div>
    </div>
  )
}
