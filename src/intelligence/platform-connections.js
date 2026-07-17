/**
 * Platform Connection System
 * 
 * Jeder Nutzer muss sein eigenes Plattform-Konto verbinden.
 * Ohne Verbindung → kein Content für diese Plattform.
 */

import { supabase } from '../lib/supabase'

// Alle unterstützten Plattformen mit ihren Verbindungsdetails
export const PLATFORMS = {
  capcut: {
    name: 'CapCut',
    icon: '✂️',
    color: '#000000',
    description: 'Video-Bearbeitung und -Publikation',
    authType: 'oauth', // 'oauth', 'api_key', 'manual'
    authUrl: 'https://www.capcut.com oauth', // Wird durch echte URL ersetzt
    scopes: [],
  },
  tiktok: {
    name: 'TikTok',
    icon: '🎵',
    color: '#000000',
    description: 'Kurzvideo-Plattform',
    authType: 'oauth',
    authUrl: 'https://www.tiktok.com/auth/authorize/',
    scopes: ['video.upload', 'video.publish'],
  },
  instagram: {
    name: 'Instagram',
    icon: '📸',
    color: '#E4405F',
    description: 'Foto- und Video-Plattform',
    authType: 'oauth',
    authUrl: 'https://api.instagram.com/oauth/authorize/',
    scopes: ['user_profile', 'user_media'],
  },
  facebook: {
    name: 'Facebook',
    icon: '👥',
    color: '#1877F2',
    description: 'Soziales Netzwerk',
    authType: 'oauth',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth/',
    scopes: ['pages_manage_posts', 'pages_read_engagement'],
  },
  linkedin: {
    name: 'LinkedIn',
    icon: '💼',
    color: '#0A66C2',
    description: 'Berufliches Netzwerk',
    authType: 'oauth',
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization/',
    scopes: ['w_member_social', 'r_liteprofile'],
  },
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    color: '#FF0000',
    description: 'Video-Plattform',
    authType: 'oauth',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/youtube.upload'],
  },
  reddit: {
    name: 'Reddit',
    icon: '💬',
    color: '#FF4500',
    description: 'Community-Plattform',
    authType: 'oauth',
    authUrl: 'https://www.reddit.com/api/v1/authorize',
    scopes: ['submit', 'identity'],
  },
  pinterest: {
    name: 'Pinterest',
    icon: '📌',
    color: '#BD081C',
    description: 'Bild-Plattform',
    authType: 'oauth',
    authUrl: 'https://www.pinterest.com/oauth/',
    scopes: ['pins:read', 'pins:write'],
  },
  email: {
    name: 'E-Mail',
    icon: '📧',
    color: '#EA4335',
    description: 'E-Mail-Versand',
    authType: 'manual', // SMTP-Konfiguration
    authUrl: null,
    scopes: [],
  },
  podcast: {
    name: 'Podcast',
    icon: '🎙️',
    color: '#8B5CF6',
    description: 'Audio-Publikation',
    authType: 'manual', // RSS-Feed-URL
    authUrl: null,
    scopes: [],
  },
}

/**
 * Prüfe ob ein Nutzer eine Plattform verbunden hat
 */
export async function checkPlatformConnection(userId, platform) {
  if (!userId || !platform) return false
  
  try {
    const { data, error } = await supabase
      .rpc('check_platform_connected', {
        p_user_id: userId,
        p_platform: platform
      })
    
    if (error) {
      console.error('[PlatformCheck] Error:', error.message)
      return false
    }
    
    return data === true
  } catch (err) {
    console.error('[PlatformCheck] Exception:', err.message)
    return false
  }
}

/**
 * Prüfe ob alle benötigten Plattformen verbunden sind
 */
export async function checkAllRequiredPlatforms(userId, platforms) {
  if (!userId || !platforms || platforms.length === 0) return { allConnected: true, missing: [] }
  
  const missing = []
  
  for (const platform of platforms) {
    const connected = await checkPlatformConnection(userId, platform)
    if (!connected) {
      missing.push(platform)
    }
  }
  
  return {
    allConnected: missing.length === 0,
    missing
  }
}

/**
 * Lade alle Plattformen eines Nutzers
 */
export async function getUserPlatforms(userId) {
  if (!userId) return []
  
  try {
    const { data, error } = await supabase
      .rpc('get_user_platforms', { p_user_id: userId })
    
    if (error) {
      console.error('[PlatformLoad] Error:', error.message)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('[PlatformLoad] Exception:', err.message)
    return []
  }
}

/**
 * Verbinde eine Plattform (speichere Token)
 */
export async function connectPlatform(userId, platform, tokenData) {
  if (!userId || !platform) return { success: false, error: 'Missing userId or platform' }
  
  try {
    const { error } = await supabase
      .from('user_platforms')
      .upsert({
        user_id: userId,
        platform: platform,
        status: 'connected',
        access_token: tokenData.accessToken || null,
        refresh_token: tokenData.refreshToken || null,
        token_expires_at: tokenData.expiresAt || null,
        platform_user_id: tokenData.platformUserId || null,
        platform_username: tokenData.platformUsername || null,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' })
    
    if (error) {
      console.error('[PlatformConnect] Error:', error.message)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err) {
    console.error('[PlatformConnect] Exception:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Trenne eine Plattform
 */
export async function disconnectPlatform(userId, platform) {
  if (!userId || !platform) return { success: false, error: 'Missing userId or platform' }
  
  try {
    const { error } = await supabase
      .from('user_platforms')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('platform', platform)
    
    if (error) {
      console.error('[PlatformDisconnect] Error:', error.message)
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err) {
    console.error('[PlatformDisconnect] Exception:', err.message)
    return { success: false, error: err.message }
  }
}
