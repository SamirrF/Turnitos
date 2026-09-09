import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useNegocioActual } from '../../lib/useNegocioActual'

const linkClase = ({ isActive }) =>
  `px-3 py-2 rounded-xl text-sm font-medium transition ${
    isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
  }`

const linkClaseMovil = ({ isActive }) =>
  `block px-3 py-2 rounded-xl text-sm font-medium transition ${
    isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100'
  }`

const ENLACES = [
  { to: 'agenda', label: 'Agenda' },
  { to: 'horarios', label: 'Horarios' },
  { to: 'reportes', label: 'Reportes' },
  { to: 'servicios', label: 'Servicios' },
  { to: 'estilistas', label: 'Estilistas' },
]

export default function PanelLayout() {
  const navigate = useNavigate()
  const { negocio, setNegocio, autenticado, cargando } = useNegocioActual()
  const [menuAbierto, setMenuAbierto] = useState(false)

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
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <span className="font-bold text-slate-800 tracking-tight truncate">{negocio.nombre}</span>
              <nav className="hidden md:flex gap-1">
                {ENLACES.map(({ to, label }) => (
                  <NavLink key={to} to={to} className={linkClase}>
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button onClick={cerrarSesion} className="hidden md:inline text-sm text-slate-500 hover:text-indigo-600 transition">
                Cerrar sesión
              </button>
              <button
                onClick={() => setMenuAbierto((v) => !v)}
                className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
                aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={menuAbierto}
              >
                {menuAbierto ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {menuAbierto && (
            <nav className="md:hidden mt-3 pb-2 flex flex-col gap-1">
              {ENLACES.map(({ to, label }) => (
                <NavLink key={to} to={to} className={linkClaseMovil} onClick={() => setMenuAbierto(false)}>
                  {label}
                </NavLink>
              ))}
              <button
                onClick={cerrarSesion}
                className="text-left px-3 py-2 text-sm text-slate-500 hover:text-indigo-600 transition"
              >
                Cerrar sesión
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Outlet context={{ negocio, setNegocio }} />
      </main>
    </div>
  )
}
