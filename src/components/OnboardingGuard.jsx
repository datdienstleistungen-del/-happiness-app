import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function OnboardingGuard({ children }) {
  const { user } = useAuth()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!user) {
      setStatus('done')
      return
    }

    const checkOnboarding = async () => {
      const localDone = localStorage.getItem('happiness-onboarding-done')
      if (localDone === 'true') {
        setStatus('done')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single()

      if (data?.onboarding_completed) {
        localStorage.setItem('happiness-onboarding-done', 'true')
        setStatus('done')
      } else {
        setStatus('redirect')
      }
    }

    checkOnboarding()
  }, [user])

  if (status === 'loading') {
    return <div className="loading">Laden...</div>
  }

  if (status === 'redirect') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
