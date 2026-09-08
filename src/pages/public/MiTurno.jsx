import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  obtenerTurnoPorToken,
  cancelarTurno,
  reprogramarTurno,
  obtenerDiasDisponibles,
  obtenerHorariosDisponibles,
  solicitarRecuperacionTurno,
} from '../../lib/publicoApi'
import { hoyISO, inicioDeMes, sumarDias } from '../../lib/fechas'
import EstadoBadge from '../panel/EstadoBadge.jsx'
import Calendario from './Calendario.jsx'

function horaActualHHMM() {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}

export default function MiTurno() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [tokenInput, setTokenInput] = useState(searchParams.get('token') ?? '')
  const [turno, setTurno] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState(null)

  const [emailBusqueda, setEmailBusqueda] = useState('')
  const [mensajeEmail, setMensajeEmail] = useState(null)
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  const [vista, setVista] = useState('detalle')

  const [mesReferencia, setMesReferencia] = useState(inicioDeMes(hoyISO()))
  const [fechasDisponibles, setFechasDisponibles] = useState(new Set())
  const [cargandoDias, setCargandoDias] = useState(false)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [horaSeleccionada, setHoraSeleccionada] = useState(null)
  const [guardandoReprogramacion, setGuardandoReprogramacion] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  function buscarTurno(tokenValue) {
    if (!tokenValue.trim()) return
    setErrorBusqueda(null)
    setCargando(true)
    obtenerTurnoPorToken(tokenValue.trim())
      .then((data) => {
        if (!data) {
          setErrorBusqueda('No encontramos ningún turno con ese código.')
          setTurno(null)
          return
        }
        setTurno(data)
        setVista('detalle')
        setSearchParams({ token: tokenValue.trim() })
      })
      .catch((err) => setErrorBusqueda(err.message ?? 'No se pudo buscar el turno'))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    const tokenUrl = searchParams.get('token')
    if (tokenUrl) buscarTurno(tokenUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBuscarSubmit(e) {
    e.preventDefault()
    buscarTurno(tokenInput)
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setEnviandoEmail(true)
    try {
      await solicitarRecuperacionTurno(emailBusqueda)
    } catch {
      // Intencional: mismo mensaje se haya encontrado algo o no, y aunque
      // la llamada falle — no queremos que la respuesta delate si un email
      // tiene turnos registrados.
    } finally {
      setEnviandoEmail(false)
      setMensajeEmail('Si ese email tiene un turno registrado, en breve vas a recibir un link para gestionarlo.')
    }
  }

  async function confirmarCancelacion() {
    setErrorAccion(null)
    try {
      const actualizado = await cancelarTurno(searchParams.get('token'))
      setTurno((t) => ({ ...t, estado: actualizado.estado }))
      setVista('detalle')
    } catch (err) {
      setErrorAccion(err.message ?? 'No se pudo cancelar el turno')
    }
  }

  function cargarDiasReprogramacion() {
    if (!turno) return
    setCargandoDias(true)
    const desde = mesReferencia < hoyISO() ? hoyISO() : mesReferencia
    const hasta = sumarDias(inicioDeMes(sumarDias(mesReferencia, 32)), -1)
    obtenerDiasDisponibles(turno.negocio_id, { desde, hasta, estilistaId: turno.estilista_id })
      .then((fechas) => setFechasDisponibles(new Set(fechas)))
      .finally(() => setCargandoDias(false))
  }

  function cargarHorariosReprogramacion() {
    if (!turno || !fechaSeleccionada) {
      setHorarios([])
      return
    }
    setCargandoHorarios(true)
    obtenerHorariosDisponibles(turno.negocio_id, turno.servicio_id, fechaSeleccionada, turno.estilista_id)
      .then((data) => {
        const filtrados =
          fechaSeleccionada === hoyISO() ? data.filter((h) => h.hora_inicio > horaActualHHMM()) : data
        setHorarios(filtrados)
      })
      .finally(() => setCargandoHorarios(false))
  }

  useEffect(() => {
    if (vista === 'reprogramar') cargarDiasReprogramacion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, mesReferencia])

  useEffect(() => {
    if (vista === 'reprogramar') cargarHorariosReprogramacion()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, fechaSeleccionada])

  function iniciarReprogramacion() {
    setFechaSeleccionada(null)
    setHoraSeleccionada(null)
    setErrorAccion(null)
    setVista('reprogramar')
  }

  function cambiarMes(delta) {
    const base = inicioDeMes(mesReferencia)
    const [y, m] = base.split('-').map(Number)
    const nuevaFecha = new Date(y, m - 1 + delta, 1)
    setMesReferencia(`${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}-01`)
    setFechaSeleccionada(null)
    setHoraSeleccionada(null)
  }

  async function confirmarReprogramacion(e) {
    e.preventDefault()
    setErrorAccion(null)
    setGuardandoReprogramacion(true)
    try {
      const actualizado = await reprogramarTurno(
        searchParams.get('token'),
        fechaSeleccionada,
        horaSeleccionada.hora_inicio,
      )
      setTurno((t) => ({ ...t, fecha: actualizado.fecha, hora_inicio: actualizado.hora_inicio, hora_fin: actualizado.hora_fin }))
      setVista('detalle')
    } catch (err) {
      if (err.message === 'Ese horario ya no está disponible') {
        setErrorAccion('Justo se ocupó ese horario. Elegí otro de la lista actualizada.')
        setHoraSeleccionada(null)
        cargarHorariosReprogramacion()
      } else {
        setErrorAccion(err.message ?? 'No se pudo reprogramar el turno')
      }
    } finally {
      setGuardandoReprogramacion(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Mi turno</h1>
          <Link to={`/${slug}`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
            Volver
          </Link>
        </div>

        {!turno && (
          <div className="space-y-6">
            <form onSubmit={handleBuscarSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
              <label className="block text-sm font-medium text-slate-700">Código de gestión</label>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="El código que te dimos al confirmar tu turno"
                required
              />
              {errorBusqueda && <p className="text-red-600 text-sm">{errorBusqueda}</p>}
              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cargando ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            <form onSubmit={handleEmailSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
              <label className="block text-sm font-medium text-slate-700">¿No tenés el código? Ingresá tu email</label>
              <input
                type="email"
                value={emailBusqueda}
                onChange={(e) => setEmailBusqueda(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
              <button
                type="submit"
                disabled={enviandoEmail}
                className="w-full border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                {enviandoEmail ? 'Enviando...' : 'Enviar'}
              </button>
              {mensajeEmail && <p className="text-sm text-slate-600">{mensajeEmail}</p>}
            </form>
          </div>
        )}

        {turno && vista === 'detalle' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-800">{turno.negocio_nombre}</h2>
              <EstadoBadge estado={turno.estado} />
            </div>
            <dl className="text-sm space-y-1">
              <p>
                <span className="font-medium text-slate-600">Servicio: </span>
                {turno.servicio_nombre} (${turno.monto})
              </p>
              <p>
                <span className="font-medium text-slate-600">Estilista: </span>
                {turno.estilista_nombre ?? 'A confirmar'}
              </p>
              <p>
                <span className="font-medium text-slate-600">Fecha: </span>
                {turno.fecha}
              </p>
              <p>
                <span className="font-medium text-slate-600">Hora: </span>
                {turno.hora_inicio.slice(0, 5)} - {turno.hora_fin.slice(0, 5)}
              </p>
              <p>
                <span className="font-medium text-slate-600">Email: </span>
                {turno.cliente_email}
              </p>
            </dl>

            {turno.estado === 'confirmado' && (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={iniciarReprogramacion}
                  className="flex-1 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Reprogramar turno
                </button>
                <button
                  onClick={() => setVista('cancelar')}
                  className="flex-1 border border-red-200 text-red-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-red-50 transition"
                >
                  Cancelar turno
                </button>
              </div>
            )}
          </div>
        )}

        {turno && vista === 'cancelar' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="font-medium text-slate-800">Cancelar turno</h2>
            <dl className="text-sm space-y-1">
              <p>
                <span className="font-medium text-slate-600">Email: </span>
                {turno.cliente_email}
              </p>
              <p>
                <span className="font-medium text-slate-600">Servicio: </span>
                {turno.servicio_nombre} (${turno.monto})
              </p>
              <p>
                <span className="font-medium text-slate-600">Fecha: </span>
                {turno.fecha} a las {turno.hora_inicio.slice(0, 5)}
              </p>
            </dl>
            <p className="text-sm text-slate-600">¿Seguro que querés cancelar este turno?</p>
            {errorAccion && <p className="text-red-600 text-sm">{errorAccion}</p>}
            <div className="flex gap-2">
              <button onClick={confirmarCancelacion} className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium shadow-sm shadow-red-200 hover:bg-red-700 transition">
                Sí, cancelar
              </button>
              <button
                onClick={() => setVista('detalle')}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        {turno && vista === 'reprogramar' && (
          <form onSubmit={confirmarReprogramacion} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h2 className="font-medium text-slate-800">Reprogramar turno</h2>
            <dl className="text-sm space-y-1">
              <p>
                <span className="font-medium text-slate-600">Email: </span>
                {turno.cliente_email}
              </p>
              <p>
                <span className="font-medium text-slate-600">Servicio: </span>
                {turno.servicio_nombre} (${turno.monto})
              </p>
            </dl>

            {cargandoDias && <p className="text-slate-400 text-xs">Actualizando disponibilidad...</p>}
            <Calendario
              mesReferencia={mesReferencia}
              fechasDisponibles={fechasDisponibles}
              fechaSeleccionada={fechaSeleccionada}
              onSeleccionar={setFechaSeleccionada}
              onCambiarMes={cambiarMes}
            />

            {fechaSeleccionada && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-500">Elegí un horario</h3>
                {cargandoHorarios ? (
                  <p className="text-slate-500 text-sm">Buscando horarios...</p>
                ) : horarios.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay horarios disponibles este día.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {horarios.map((h) => (
                      <button
                        type="button"
                        key={h.hora_inicio}
                        onClick={() => setHoraSeleccionada(h)}
                        className={`border rounded px-3 py-2 text-sm bg-white ${
                          horaSeleccionada?.hora_inicio === h.hora_inicio
                            ? 'border-slate-800 ring-1 ring-slate-800'
                            : 'border-slate-200'
                        }`}
                      >
                        {h.hora_inicio.slice(0, 5)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errorAccion && <p className="text-red-600 text-sm">{errorAccion}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!horaSeleccionada || guardandoReprogramacion}
                className="flex-1 bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition text-sm disabled:opacity-50"
              >
                {guardandoReprogramacion ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setVista('detalle')}
                className="flex-1 border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-slate-50 transition"
              >
                Volver
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
