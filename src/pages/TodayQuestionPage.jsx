import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/translations'
import { MessageCircle, Send, SkipForward } from 'lucide-react'
import './TodayQuestionPage.css'

const QUESTIONS = [
  "What makes a friendship last?",
  "What is one small thing that made you smile today?",
  "If you could have dinner with anyone in the world, who would it be?",
  "What is a skill you'd love to learn?",
  "What does happiness mean to you?",
  "What is the best advice you ever received?",
  "What is a tradition from your country that you love?",
  "What is something you accomplished this week?"
]

export default function TodayQuestionPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [answer, setAnswer] = useState('')
  const [posting, setPosting] = useState(false)
  const [question] = useState(() => {
    const dayIndex = Math.floor(Date.now() / 86400000) % QUESTIONS.length
    return QUESTIONS[dayIndex]
  })

  const postAnswer = async () => {
    if (!answer.trim() || posting) return
    setPosting(true)
    try {
      await supabase.from('posts').insert({
        user_id: user.id,
        content: answer.trim(),
      })
    } catch (err) {
      console.error('Post error:', err)
    }
    navigate('/community', { replace: true })
  }

  const skip = () => {
    navigate('/community', { replace: true })
  }

  const handleKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      postAnswer()
    }
  }

  return (
    <div className="tq-page">
      <div className="tq-center">
        <div className="tq-icon"><MessageCircle size={28} /></div>
        <h1 className="tq-title">{t('onboarding.todayTitle')}</h1>
        <p className="tq-question">{question}</p>

        <textarea
          className="tq-textarea"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t('onboarding.todayPlaceholder')}
          rows={5}
          autoFocus
        />

        <div className="tq-actions">
          <button className="tq-btn tq-btn-primary" onClick={postAnswer} disabled={!answer.trim() || posting}>
            {posting ? <span className="tq-spinner" /> : <><Send size={16} /> {t('onboarding.todayPost')}</>}
          </button>
          <button className="tq-btn tq-btn-skip" onClick={skip}>
            <SkipForward size={16} /> {t('onboarding.todaySkip')}
          </button>
        </div>
      </div>
    </div>
  )
}
