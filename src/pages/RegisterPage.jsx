import React, { useEffect } from 'react'

/**
 * Registrierung ist dauerhaft deaktiviert.
 * Leitet unbefugte Gäste sofort auf https://dat-dat.de um.
 */
export default function RegisterPage() {
  useEffect(() => {
    window.location.replace('https://dat-dat.de')
  }, [])
  return null
}
