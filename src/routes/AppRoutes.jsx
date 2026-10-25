import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'

// Auto-Reload-Wrapper für dynamische Imports:
// Fängt ChunkLoadErrors nach neuen Deployments ab und lädt die App frisch
export function lazyWithRetry(componentImport) {
  return lazy(async () => {
    try {
      return await componentImport()
    } catch (error) {
      const isChunkError = error && (
        error.message?.includes('dynamically imported module') ||
        error.message?.includes('Loading chunk') ||
        error.message?.includes('chunkloaderror') ||
        error.name === 'ChunkLoadError'
      )
      if (isChunkError) {
        const lastReload = parseInt(sessionStorage.getItem('nexus_chunk_reload_time') || '0', 10)
        const now = Date.now()
        if (now - lastReload > 8000) {
          sessionStorage.setItem('nexus_chunk_reload_time', now.toString())
          window.location.reload()
          return new Promise(() => {}) // Verhindert Render-Crash während Reload
        }
      }
      throw error
    }
  })
}

// Lazy loaded core Mandate Origination Desk pages
const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'))
const SalesWorkspacePage = lazyWithRetry(() => import('../pages/SalesWorkspacePage'))
const MandateArchivePage = lazyWithRetry(() => import('../pages/MandateArchivePage'))
const NexusDashboard = lazyWithRetry(() => import('../pages/NexusDashboard'))
const EventExplorerPage = lazyWithRetry(() => import('../pages/EventExplorerPage'))
const LeadIntelligencePage = lazyWithRetry(() => import('../pages/NexusLeadIntelligencePage'))
const CoachChatPage = lazyWithRetry(() => import('../pages/CoachChatPage'))
const LegalPage = lazyWithRetry(() => import('../pages/LegalPage'))

function ProtectedRoute({ children }) {
  const { user, profile, loading } = useAuth()
  const { t } = useLanguage()
  if (loading) return <div className="loading">{t('auth.logging') || 'Laden...'}</div>
  if (!user || profile?.banned) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function AppRoutes() {
  const { user } = useAuth()

  return (
    <Suspense fallback={<div className="loading">Laden...</div>}>
      <Routes>
        {/* Öffentliche Admin-Auth-Route -> Nach Login direkt in den Sales Workspace */}
        <Route path="/login" element={user ? <Navigate to="/nexus/sales-workspace" replace /> : <LoginPage />} />
        
        {/* Registrierung -> Weiterleitung auf Login */}
        <Route path="/register" element={<Navigate to="/login" replace />} />

        {/* Startseite und NeXus Root -> Direkt in den Sales Workspace oder auf Login */}
        <Route path="/" element={user ? <Navigate to="/nexus/sales-workspace" replace /> : <Navigate to="/login" replace />} />
        <Route path="/nexus" element={user ? <Navigate to="/nexus/sales-workspace" replace /> : <Navigate to="/login" replace />} />

        {/* NeXus Mandate Origination Desk Core Routes (vollständig geschützt) */}
        <Route path="/nexus/sales-workspace" element={<ProtectedRoute><SalesWorkspacePage /></ProtectedRoute>} />
        <Route path="/nexus/mandats-archiv" element={<ProtectedRoute><MandateArchivePage /></ProtectedRoute>} />
        <Route path="/mandats-archiv" element={<ProtectedRoute><MandateArchivePage /></ProtectedRoute>} />
        <Route path="/nexus/lead-radar" element={<Navigate to="/nexus/mandats-archiv" replace />} />
        <Route path="/lead-radar" element={<Navigate to="/nexus/mandats-archiv" replace />} />
        <Route path="/nexus/dashboard" element={<ProtectedRoute><NexusDashboard /></ProtectedRoute>} />
        <Route path="/nexus/events" element={<ProtectedRoute><EventExplorerPage /></ProtectedRoute>} />
        <Route path="/nexus/lead-intelligence" element={<ProtectedRoute><LeadIntelligencePage /></ProtectedRoute>} />
        <Route path="/nexus/sales-workspace/coach/:leadId?" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />

        {/* Bereinigung alter / fremder Routen -> Saubere Weiterleitung in den Sales Workspace */}
        <Route path="/nexus/angebotsanalyse" element={<Navigate to="/nexus/sales-workspace" replace />} />
        <Route path="/angebotsanalyse" element={<Navigate to="/nexus/sales-workspace" replace />} />
        <Route path="/kalkulation*" element={<Navigate to="/nexus/sales-workspace" replace />} />
        <Route path="/handwerk*" element={<Navigate to="/nexus/sales-workspace" replace />} />
        <Route path="/video*" element={<Navigate to="/nexus/sales-workspace" replace />} />
        <Route path="/capcut*" element={<Navigate to="/nexus/sales-workspace" replace />} />

        {/* Compliance & Rechtliches */}
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/impressum" element={<LegalPage />} />
        <Route path="/datenschutz" element={<LegalPage />} />
        <Route path="/agb" element={<LegalPage />} />

        {/* Catch-all: Alle unbekannten URLs zwingend auf /login leiten */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}

