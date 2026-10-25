import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../i18n/translations.jsx'

// Lazy loaded pages
const LoginPage = lazy(() => import('../pages/LoginPage'))
const RegisterPage = lazy(() => import('../pages/RegisterPage'))
const CommunityPage = lazy(() => import('../pages/CommunityPage'))
const FriendsPage = lazy(() => import('../pages/FriendsPage'))
const MarketplacePage = lazy(() => import('../pages/MarketplacePage'))
const JobsPage = lazy(() => import('../pages/JobsPage'))
const CoursesPage = lazy(() => import('../pages/CoursesPage'))
const HousingPage = lazy(() => import('../pages/HousingPage'))
const ProfilePage = lazy(() => import('../pages/ProfilePage'))
const WissenschaftPage = lazy(() => import('../pages/WissenschaftPage'))
const HistoryPage = lazy(() => import('../pages/HistoryPage'))
const AdminPage = lazy(() => import('../pages/AdminPage'))
const LegalPage = lazy(() => import('../pages/LegalPage'))
const PhotoEditorPage = lazy(() => import('../pages/PhotoEditorPage'))
const FotostoryPage = lazy(() => import('../pages/FotostoryPage'))
const AIChatPage = lazy(() => import('../pages/AIChatPage'))
const ExecutionPipeline = lazy(() => import('../pages/ExecutionPipeline'))
const TikTokVideoPage = lazy(() => import('../pages/TikTokVideoPage'))
const CreatorAcademyPage = lazy(() => import('../pages/CreatorAcademyPage'))
const PostPreparationPage = lazy(() => import('../pages/PostPreparationPage'))
const OnboardingPage = lazy(() => import('../pages/OnboardingPage'))
const TodayQuestionPage = lazy(() => import('../pages/TodayQuestionPage'))
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage'))
const LeadRadarPage = lazy(() => import('../pages/NexusLeadRadarPage'))
const CreatorSuccessPage = lazy(() => import('../pages/CreatorSuccessPage'))
const TourPage = lazy(() => import('../pages/TourPage'))
const VideoFinderPage = lazy(() => import('../pages/VideoFinderPage'))
const CoachChatPage = lazy(() => import('../pages/CoachChatPage'))
const KiVisibilityPage = lazy(() => import('../pages/KiVisibilityPage'))
const VideoScriptPage = lazy(() => import('../pages/VideoScriptPage'))
const IdeenschmiedePage = lazy(() => import('../pages/IdeenschmiedePage'))
const AngebotsanalysePage = lazy(() => import('../pages/AngebotsanalysePage'))
const SalesWorkspacePage = lazy(() => import('../pages/SalesWorkspacePage'))
const LeadIntelligencePage = lazy(() => import('../pages/NexusLeadIntelligencePage'))
const EventExplorerPage = lazy(() => import('../pages/EventExplorerPage'))
const PlatformEngine = lazy(() => import('../pages/PlatformEngine'))
const LandingPage = lazy(() => import('../pages/LandingPage'))
const NexusDashboard = lazy(() => import('../pages/NexusDashboard'))




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

        {/* NeXus Core Routes (vollständig geschützt) */}
        <Route path="/nexus/dashboard" element={<ProtectedRoute><NexusDashboard /></ProtectedRoute>} />
        <Route path="/nexus/angebotsanalyse" element={<ProtectedRoute><AngebotsanalysePage /></ProtectedRoute>} />
        <Route path="/nexus/lead-radar" element={<ProtectedRoute><LeadRadarPage /></ProtectedRoute>} />
        <Route path="/nexus/events" element={<ProtectedRoute><EventExplorerPage /></ProtectedRoute>} />
        <Route path="/nexus/sales-workspace" element={<ProtectedRoute><SalesWorkspacePage /></ProtectedRoute>} />
        <Route path="/nexus/sales-workspace/coach/:leadId?" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />
        <Route path="/nexus/lead-intelligence" element={<ProtectedRoute><LeadIntelligencePage /></ProtectedRoute>} />
        <Route path="/coach" element={<ProtectedRoute><CoachChatPage /></ProtectedRoute>} />

        {/* Alle sonstigen App-Routen (vollständig geschützt) */}
        <Route path="/landing" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PlatformEngine /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
        <Route path="/today-question" element={<ProtectedRoute><TodayQuestionPage /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><CommunityPage /></ProtectedRoute>} />
        <Route path="/friends" element={<ProtectedRoute><FriendsPage /></ProtectedRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
        <Route path="/jobs" element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
        <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
        <Route path="/housing" element={<ProtectedRoute><HousingPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/wissenschaft" element={<ProtectedRoute><WissenschaftPage /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/admin/creator-success" element={<ProtectedRoute><CreatorSuccessPage /></ProtectedRoute>} />
        <Route path="/photo-editor" element={<ProtectedRoute><PhotoEditorPage /></ProtectedRoute>} />
        <Route path="/fotostory" element={<ProtectedRoute><FotostoryPage /></ProtectedRoute>} />
        <Route path="/ai-chat" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
        <Route path="/execute" element={<ProtectedRoute><ExecutionPipeline /></ProtectedRoute>} />
        <Route path="/creator-academy" element={<ProtectedRoute><CreatorAcademyPage /></ProtectedRoute>} />
        <Route path="/post-preparation" element={<ProtectedRoute><PostPreparationPage /></ProtectedRoute>} />
        <Route path="/capcut-studio" element={<ProtectedRoute><TikTokVideoPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/tour" element={<ProtectedRoute><TourPage /></ProtectedRoute>} />
        <Route path="/video-finder" element={<ProtectedRoute><VideoFinderPage /></ProtectedRoute>} />
        <Route path="/video-script" element={<ProtectedRoute><VideoScriptPage /></ProtectedRoute>} />
        <Route path="/ideenschmiede" element={<ProtectedRoute><IdeenschmiedePage /></ProtectedRoute>} />
        <Route path="/ki-sichtbarkeit" element={<ProtectedRoute><KiVisibilityPage /></ProtectedRoute>} />
        <Route path="/admin/lead-radar" element={<ProtectedRoute><LeadRadarPage /></ProtectedRoute>} />
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
