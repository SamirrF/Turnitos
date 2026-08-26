import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useSuperAdminActual } from '../../lib/useSuperAdminActual'

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const { esSuperAdmin, autenticado, cargando } = useSuperAdminActual()

  useEffect(() => {
    if (autenticado === false) {
      navigate('/login')
      return
    }
    if (!cargando && autenticado && esSuperAdmin === false) {
      navigate('/panel')
    }
  }, [autenticado, cargando, esSuperAdmin, navigate])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (cargando || !esSuperAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-slate-800">Turnitos — Super Admin</span>
          <button onClick={cerrarSesion} className="text-sm text-slate-500 hover:text-slate-800">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
