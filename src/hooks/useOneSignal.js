import { useEffect, useState } from 'react'

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || ''

export function useOneSignal(user) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [prompted, setPrompted] = useState(false)

  useEffect(() => {
    if (!ONESIGNAL_APP_ID || !window.OneSignal) return

    window.OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: import.meta.env.DEV,
    })

    window.OneSignal.isPushNotificationsEnabled((enabled) => {
      setIsSubscribed(enabled)
    })

    window.OneSignal.on('subscriptionChange', (isSubscribed) => {
      setIsSubscribed(isSubscribed)
    })
  }, [])

  useEffect(() => {
    if (!window.OneSignal || !user) return

    window.OneSignal.sendTags({
      user_id: user.id,
      language: navigator.language || navigator.userLanguage || 'de',
    })
  }, [user])

  const promptSubscribe = async () => {
    if (!window.OneSignal) return false
    setPrompted(true)

    const isPushSupported = await window.OneSignal.isPushNotificationsSupported()
    if (!isPushSupported) return false

    const permission = await window.OneSignal.getNotificationPermission()
    if (permission === 'denied') return false

    await window.OneSignal.showSlidedownPrompt()
    const enabled = await window.OneSignal.isPushNotificationsEnabled()
    setIsSubscribed(enabled)
    return enabled
  }

  return { isSubscribed, prompted, promptSubscribe }
}
