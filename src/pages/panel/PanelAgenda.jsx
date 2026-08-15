import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listarEstilistas } from '../../lib/negocioApi'
import { listarTurnos } from '../../lib/turnoApi'
import { hoyISO, inicioDeSemana, finDeSemana, sumarDias } from '../../lib/fechas'
import EstadoBadge from './EstadoBadge.jsx'
import TurnoDetalle from './TurnoDetalle.jsx'

export default function PanelAgenda() {
  const { negocio } = useOutletContext()
  const [fecha, setFecha] = useState(hoyISO())
  const [vista, setVista] = useState('dia')
  const [estilistaId, setEstilistaId] = useState('')
  const [estilistas, setEstilistas] = useState([])
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null)

  useEffect(() => {
    listarEstilistas(negocio.id).then(setEstilistas)
  }, [negocio.id])

  const desde = vista === 'semana' ? inicioDeSemana(fecha) : fecha
  const hasta = vista === 'semana' ? finDeSemana(fecha) : fecha

  useEffect(() => {
    let activo = true
    setCargando(true)
    listarTurnos(negocio.id, { desde, hasta, estilistaId: estilistaId || undefined })
      .then((data) => {
        if (activo) setTurnos(data)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [negocio.id, desde, hasta, estilistaId])

  function irAnterior() {
    setFecha((f) => sumarDias(f, vista === 'semana' ? -7 : -1))
  }

  function irSiguiente() {
    setFecha((f) => sumarDias(f, vista === 'semana' ? 7 : 1))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Agenda</h1>

      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={irAnterior} className="border rounded px-2 py-1 text-slate-600">
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border rounded px-2 py-1"
          />
          <button onClick={irSiguiente} className="border rounded px-2 py-1 text-slate-600">
            →
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setVista('dia')}
            className={`px-3 py-1 rounded text-sm ${vista === 'dia' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Día
          </button>
          <button
            onClick={() => setVista('semana')}
            className={`px-3 py-1 rounded text-sm ${vista === 'semana' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Semana
          </button>
        </div>

        <select
          value={estilistaId}
          onChange={(e) => setEstilistaId(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">Todos los estilistas</option>
          {estilistas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p className="text-slate-500">Cargando...</p>
      ) : turnos.length === 0 ? (
        <p className="text-slate-500">No hay turnos en este rango.</p>
      ) : (
        <ul className="space-y-2">
          {turnos.map((t) => (
            <li
              key={t.id}
              onClick={() => setTurnoSeleccionado(t)}
              className="bg-white rounded-lg shadow p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {t.fecha} · {t.hora_inicio} - {t.hora_fin}
                </p>
                <p className="text-sm text-slate-600">
                  {t.servicio?.nombre} · {t.estilista?.nombre ?? 'Cualquiera disponible'} · {t.cliente_nombre}
                </p>
              </div>
              <EstadoBadge estado={t.estado} />
            </li>
          ))}
        </ul>
      )}

      <TurnoDetalle turno={turnoSeleccionado} onCerrar={() => setTurnoSeleccionado(null)} />
    </div>
  )
}
