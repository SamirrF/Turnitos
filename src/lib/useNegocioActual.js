import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { obtenerNegocioActual } from './negocioApi'

export function useNegocioActual() {
  const [negocio, setNegocio] = useState(null)
  const [autenticado, setAutenticado] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargarDesdeSesion(session) {
      if (!activo) return

      if (!session) {
        setAutenticado(false)
        setNegocio(null)
        setCargando(false)
        return
      }

      setAutenticado(true)
      const negocioActual = await obtenerNegocioActual()
      if (!activo) return
      setNegocio(negocioActual)
      setCargando(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => cargarDesdeSesion(session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => cargarDesdeSesion(session))

    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  return { negocio, setNegocio, autenticado, cargando }
}
