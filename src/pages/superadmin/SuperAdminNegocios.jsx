import { useEffect, useState } from 'react'
import { listarNegocios, contarNegocios, contarTurnos } from '../../lib/superAdminApi'
import { actualizarNegocio } from '../../lib/negocioApi'

export default function SuperAdminNegocios() {
  const [negocios, setNegocios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [totalNegocios, setTotalNegocios] = useState(0)
  const [totalTurnos, setTotalTurnos] = useState(0)
  const [actualizandoId, setActualizandoId] = useState(null)

  async function cargar() {
    setCargando(true)
    const [lista, negociosCount, turnosCount] = await Promise.all([
      listarNegocios(),
      contarNegocios(),
      contarTurnos(),
    ])
    setNegocios(lista)
    setTotalNegocios(negociosCount)
    setTotalTurnos(turnosCount)
    setCargando(false)
  }

  useEffect(() => {
    cargar()
  }, [])

  async function toggleEstado(negocio) {
    setActualizandoId(negocio.id)
    try {
      await actualizarNegocio(negocio.id, { estado: negocio.estado === 'activo' ? 'inactivo' : 'activo' })
      await cargar()
    } finally {
      setActualizandoId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Negocios registrados</h1>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-500">Negocios totales</p>
          <p className="text-2xl font-semibold text-slate-800">{totalNegocios}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-slate-500">Turnos totales en la plataforma</p>
          <p className="text-2xl font-semibold text-slate-800">{totalTurnos}</p>
        </div>
      </div>

      {cargando ? (
        <p className="text-slate-500">Cargando...</p>
      ) : negocios.length === 0 ? (
        <p className="text-slate-500">Todavía no hay negocios registrados.</p>
      ) : (
        <ul className="space-y-2">
          {negocios.map((n) => (
            <li key={n.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-800">{n.nombre}</p>
                <p className="text-sm text-slate-500">/{n.slug}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    n.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {n.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
                <button
                  onClick={() => toggleEstado(n)}
                  disabled={actualizandoId === n.id}
                  className="text-sm border border-slate-300 rounded px-3 py-1 text-slate-600 disabled:opacity-50"
                >
                  {n.estado === 'activo' ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
