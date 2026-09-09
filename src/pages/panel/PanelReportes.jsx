import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listarTurnos } from '../../lib/turnoApi'
import { hoyISO, inicioDeSemana, finDeSemana, inicioDeMes, finDeMes } from '../../lib/fechas'

export default function PanelReportes() {
  const { negocio } = useOutletContext()
  const [desde, setDesde] = useState(inicioDeMes(hoyISO()))
  const [hasta, setHasta] = useState(finDeMes(hoyISO()))
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    setCargando(true)
    listarTurnos(negocio.id, { desde, hasta })
      .then((data) => {
        if (activo) setTurnos(data)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [negocio.id, desde, hasta])

  function elegirHoy() {
    setDesde(hoyISO())
    setHasta(hoyISO())
  }

  function elegirSemana() {
    setDesde(inicioDeSemana(hoyISO()))
    setHasta(finDeSemana(hoyISO()))
  }

  function elegirMes() {
    setDesde(inicioDeMes(hoyISO()))
    setHasta(finDeMes(hoyISO()))
  }

  const totalTurnos = turnos.length
  const cancelados = turnos.filter((t) => t.estado === 'cancelado').length

  const ingresosPorServicio = turnos
    .filter((t) => t.estado === 'completado')
    .reduce((acc, t) => {
      const nombre = t.servicio?.nombre ?? 'Sin servicio'
      acc[nombre] = (acc[nombre] ?? 0) + Number(t.monto)
      return acc
    }, {})

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Reportes</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <div className="flex gap-1">
          <button onClick={elegirHoy} className="px-3 py-2 rounded-xl text-sm bg-slate-100 text-slate-600">
            Hoy
          </button>
          <button onClick={elegirSemana} className="px-3 py-2 rounded-xl text-sm bg-slate-100 text-slate-600">
            Esta semana
          </button>
          <button onClick={elegirMes} className="px-3 py-2 rounded-xl text-sm bg-slate-100 text-slate-600">
            Este mes
          </button>
        </div>
      </div>

      {cargando ? (
        <p className="text-slate-500">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <p className="text-sm text-slate-500">Turnos en el período</p>
              <p className="text-2xl font-semibold text-slate-800">{totalTurnos}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <p className="text-sm text-slate-500">Cancelaciones</p>
              <p className="text-2xl font-semibold text-slate-800">{cancelados}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <p className="text-sm text-slate-500 mb-2">Ingresos por servicio (turnos completados)</p>
            {Object.keys(ingresosPorServicio).length === 0 ? (
              <p className="text-slate-500 text-sm">Sin ingresos en este período.</p>
            ) : (
              <ul className="divide-y">
                {Object.entries(ingresosPorServicio).map(([nombre, monto]) => (
                  <li key={nombre} className="flex justify-between py-2 text-sm">
                    <span className="text-slate-700">{nombre}</span>
                    <span className="font-medium text-slate-800">${monto.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
