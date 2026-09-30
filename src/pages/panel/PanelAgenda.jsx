import { useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listarEstilistas } from '../../lib/negocioApi'
import { listarTurnos } from '../../lib/turnoApi'
import { hoyISO, inicioDeSemana, finDeSemana, sumarDias } from '../../lib/fechas'
import EstadoBadge from './EstadoBadge.jsx'
import TurnoDetalle from './TurnoDetalle.jsx'
import NuevoTurnoModal from './NuevoTurnoModal.jsx'

export default function PanelAgenda() {
  const { negocio } = useOutletContext()
  const [fecha, setFecha] = useState(hoyISO())
  const [vista, setVista] = useState('dia')
  const [estilistaId, setEstilistaId] = useState('')
  const [estilistas, setEstilistas] = useState([])
  const [turnos, setTurnos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null)
  const [creandoTurno, setCreandoTurno] = useState(false)
  // Contador para forzar recarga aunque desde/hasta/estilista no cambien.
  const [recarga, setRecarga] = useState(0)
  // Id del turno recién creado: se abre su detalle cuando llega en la recarga.
  // Ref y no state: se consume dentro del .then() de la carga misma, así no
  // depende del orden entre effects ni de un render intermedio con la lista vieja.
  const abrirTurnoIdRef = useRef(null)

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
        if (!activo) return
        setTurnos(data)
        if (abrirTurnoIdRef.current) {
          const creado = data.find((t) => t.id === abrirTurnoIdRef.current)
          if (creado) setTurnoSeleccionado(creado)
          abrirTurnoIdRef.current = null
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [negocio.id, desde, hasta, estilistaId, recarga])

  function turnoActualizado() {
    setTurnoSeleccionado(null)
    setRecarga((r) => r + 1)
  }

  function turnoCreado(turno) {
    setCreandoTurno(false)
    setFecha(turno.fecha)
    abrirTurnoIdRef.current = turno.id
    setRecarga((r) => r + 1)
  }

  function irAnterior() {
    setFecha((f) => sumarDias(f, vista === 'semana' ? -7 : -1))
  }

  function irSiguiente() {
    setFecha((f) => sumarDias(f, vista === 'semana' ? 7 : 1))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Agenda</h1>
        <button
          onClick={() => setCreandoTurno(true)}
          className="bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition"
        >
          + Nuevo turno
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={irAnterior} className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-600">
            ←
          </button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
          <button onClick={irSiguiente} className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-600">
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
          className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm"
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
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800">
                  {t.fecha} · {t.hora_inicio} - {t.hora_fin}
                </p>
                <p className="text-sm text-slate-600 break-words">
                  {t.servicio?.nombre} · {t.estilista?.nombre ?? 'Cualquiera disponible'} · {t.cliente_nombre}
                </p>
              </div>
              <EstadoBadge estado={t.estado} />
            </li>
          ))}
        </ul>
      )}

      <TurnoDetalle
        key={turnoSeleccionado?.id}
        turno={turnoSeleccionado}
        onCerrar={() => setTurnoSeleccionado(null)}
        onActualizado={turnoActualizado}
      />

      {creandoTurno && (
        <NuevoTurnoModal
          negocioId={negocio.id}
          fechaInicial={fecha}
          onCerrar={() => setCreandoTurno(false)}
          onCreado={turnoCreado}
        />
      )}
    </div>
  )
}
