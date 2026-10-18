import { Navigate } from 'react-router-dom'

/**
 * Registrierung ist dauerhaft deaktiviert (Abschottung für NeXus).
 * Leitet alle Aufrufe sofort auf /login um.
 */
export default function RegisterPage() {
  return <Navigate to="/login" replace />
}
