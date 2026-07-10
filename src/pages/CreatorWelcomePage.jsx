import { useNavigate } from 'react-router-dom'
import { Rocket, PenTool, TrendingUp, BookOpen, ArrowRight } from 'lucide-react'
import './CreatorWelcomePage.css'

export default function CreatorWelcomePage() {
  const navigate = useNavigate()

  const go = (path) => {
    navigate(path, { replace: true })
  }

  return (
    <div className="cw-page">
      <div className="cw-center">
        <div className="cw-icon"><Rocket size={28} /></div>
        <h1 className="cw-title">Welcome, Creator!</h1>
        <p className="cw-subtitle">Today we make your content better.</p>

        <div className="cw-cards">
          <button className="cw-card" onClick={() => go('/creator-academy')}>
            <span className="cw-card-icon"><PenTool size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">Create Content</span>
              <span className="cw-card-desc">Start with a new idea</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>

          <button className="cw-card" onClick={() => go('/creator-academy')}>
            <span className="cw-card-icon"><TrendingUp size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">Improve my Content</span>
              <span className="cw-card-desc">Get AI feedback on your post</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>

          <button className="cw-card" onClick={() => go('/creator-academy')}>
            <span className="cw-card-icon"><BookOpen size={24} /></span>
            <span className="cw-card-content">
              <span className="cw-card-title">Learn Creator Skills</span>
              <span className="cw-card-desc">Tips and strategies</span>
            </span>
            <ArrowRight size={20} className="cw-card-arrow" />
          </button>
        </div>

        <button className="cw-skip" onClick={() => go('/')}>
          Skip → Go to Dashboard
        </button>
      </div>
    </div>
  )
}
