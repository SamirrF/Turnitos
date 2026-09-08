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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-slate-800 tracking-tight">Turnitos <span className="text-indigo-600">Super Admin</span></span>
          <button onClick={cerrarSesion} className="text-sm text-slate-500 hover:text-indigo-600 transition">
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
