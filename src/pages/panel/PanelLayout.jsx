import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useNegocioActual } from '../../lib/useNegocioActual'

const linkClase = ({ isActive }) =>
  `px-3 py-2 rounded-xl text-sm font-medium transition ${
    isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
  }`

export default function PanelLayout() {
  const navigate = useNavigate()
  const { negocio, setNegocio, autenticado, cargando } = useNegocioActual()

  useEffect(() => {
    if (autenticado === false) {
      navigate('/login')
      return
    }
    if (!cargando && autenticado && !negocio) {
      navigate('/onboarding')
    }
  }, [autenticado, cargando, negocio, navigate])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  if (cargando || !negocio) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-800 tracking-tight">{negocio.nombre}</span>
            <nav className="flex gap-1">
              <NavLink to="agenda" className={linkClase}>
                Agenda
              </NavLink>
              <NavLink to="horarios" className={linkClase}>
                Horarios
              </NavLink>
              <NavLink to="reportes" className={linkClase}>
                Reportes
              </NavLink>
              <NavLink to="servicios" className={linkClase}>
                Servicios
              </NavLink>
              <NavLink to="estilistas" className={linkClase}>
                Estilistas
              </NavLink>
            </nav>
          </div>
          <button onClick={cerrarSesion} className="text-sm text-slate-500 hover:text-indigo-600 transition">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet context={{ negocio, setNegocio }} />
      </main>
    </div>
  )
}
