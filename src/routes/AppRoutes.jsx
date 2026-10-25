import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'

// Lazy loaded core Mandate Origination Desk pages
const LoginPage = lazy(() => import('../pages/LoginPage'))
const SalesWorkspacePage = lazy(() => import('../pages/SalesWorkspacePage'))
const LeadRadarPage = lazy(() => import('../pages/NexusLeadRadarPage'))
const NexusDashboard = lazy(() => import('../pages/NexusDashboard'))
const AngebotsanalysePage = lazy(() => import('../pages/AngebotsanalysePage'))
const EventExplorerPage = lazy(() => import('../pages/EventExplorerPage'))
const LeadIntelligencePage = lazy(() => import('../pages/NexusLeadIntelligencePage'))
const CoachChatPage = lazy(() => import('../pages/CoachChatPage'))
const LegalPage = lazy(() => import('../pages/LegalPage'))

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
        <Route path="/nexus/lead-radar" element={<ProtectedRoute><LeadRadarPage /></ProtectedRoute>} />
        <Route path="/nexus/dashboard" element={<ProtectedRoute><NexusDashboard /></ProtectedRoute>} />
        <Route path="/nexus/angebotsanalyse" element={<ProtectedRoute><AngebotsanalysePage /></ProtectedRoute>} />
        <Route path="/nexus/events" element={<ProtectedRoute><EventExplorerPage /></ProtectedRoute>} />
        <Route path="/nexus/lead-intelligence" element={<ProtectedRoute><LeadIntelligencePage /></ProtectedRoute>} />
        <Route path="/nexus/sales-workspace/coach/:leadId?" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />

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

