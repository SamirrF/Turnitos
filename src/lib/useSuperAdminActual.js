import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export function useSuperAdminActual() {
  const [esSuperAdmin, setEsSuperAdmin] = useState(null)
  const [autenticado, setAutenticado] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true

    async function cargarDesdeSesion(session) {
      if (!activo) return

      if (!session) {
        setAutenticado(false)
        setEsSuperAdmin(false)
        setCargando(false)
        return
      }

      setAutenticado(true)
      const { data } = await supabase.rpc('is_super_admin')
      if (!activo) return
      setEsSuperAdmin(data === true)
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

  return { esSuperAdmin, autenticado, cargando }
}
