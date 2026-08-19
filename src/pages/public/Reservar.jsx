import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  obtenerNegocioPorSlug,
  listarServiciosActivos,
  listarEstilistasActivos,
  obtenerDiasDisponibles,
  obtenerHorariosDisponibles,
} from '../../lib/publicoApi'
import { hoyISO, inicioDeMes, sumarDias } from '../../lib/fechas'
import Calendario from './Calendario.jsx'

function horaActualHHMM() {
  const ahora = new Date()
  return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`
}

export default function Reservar() {
  const { slug } = useParams()
  const [negocio, setNegocio] = useState(null)
  const [cargandoNegocio, setCargandoNegocio] = useState(true)
  const [error, setError] = useState(null)

  const [servicios, setServicios] = useState([])
  const [estilistas, setEstilistas] = useState([])
  const [servicioId, setServicioId] = useState(null)
  const [estilistaId, setEstilistaId] = useState('')

  const [mesReferencia, setMesReferencia] = useState(inicioDeMes(hoyISO()))
  const [fechasDisponibles, setFechasDisponibles] = useState(new Set())
  const [cargandoDias, setCargandoDias] = useState(false)
  const [fechaSeleccionada, setFechaSeleccionada] = useState(null)

  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [horaSeleccionada, setHoraSeleccionada] = useState(null)

  useEffect(() => {
    let activo = true
    obtenerNegocioPorSlug(slug)
      .then((data) => {
        if (!activo) return
        setNegocio(data)
        setCargandoNegocio(false)
        if (data) {
          listarServiciosActivos(data.id)
            .then((s) => activo && setServicios(s))
            .catch((err) => activo && setError(err.message))
          listarEstilistasActivos(data.id)
            .then((e) => activo && setEstilistas(e))
            .catch((err) => activo && setError(err.message))
        }
      })
      .catch((err) => {
        if (!activo) return
        setError(err.message)
        setCargandoNegocio(false)
      })
    return () => {
      activo = false
    }
  }, [slug])

  useEffect(() => {
    if (!negocio || !servicioId) return
    let activo = true
    setCargandoDias(true)
    const desde = mesReferencia < hoyISO() ? hoyISO() : mesReferencia
    const hasta = sumarDias(inicioDeMes(sumarDias(mesReferencia, 32)), -1)
    obtenerDiasDisponibles(negocio.id, { desde, hasta, estilistaId })
      .then((fechas) => {
        if (activo) setFechasDisponibles(new Set(fechas))
      })
      .catch((err) => activo && setError(err.message))
      .finally(() => {
        if (activo) setCargandoDias(false)
      })
    return () => {
      activo = false
    }
  }, [negocio, servicioId, estilistaId, mesReferencia])

  useEffect(() => {
    if (!negocio || !servicioId || !fechaSeleccionada) {
      setHorarios([])
      return
    }
    let activo = true
    setCargandoHorarios(true)
    obtenerHorariosDisponibles(negocio.id, servicioId, fechaSeleccionada, estilistaId)
      .then((data) => {
        if (!activo) return
        const filtrados =
          fechaSeleccionada === hoyISO()
            ? data.filter((h) => h.hora_inicio > horaActualHHMM())
            : data
        setHorarios(filtrados)
      })
      .catch((err) => activo && setError(err.message))
      .finally(() => {
        if (activo) setCargandoHorarios(false)
      })
    return () => {
      activo = false
    }
  }, [negocio, servicioId, estilistaId, fechaSeleccionada])

  function elegirServicio(id) {
    setServicioId(id)
    setFechaSeleccionada(null)
    setHoraSeleccionada(null)
  }

  function elegirEstilista(id) {
    setEstilistaId(id)
    setFechaSeleccionada(null)
    setHoraSeleccionada(null)
  }

  function cambiarMes(delta) {
    const base = inicioDeMes(mesReferencia)
    const [y, m] = base.split('-').map(Number)
    const nuevaFecha = new Date(y, m - 1 + delta, 1)
    setMesReferencia(
      `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}-01`,
    )
    setFechaSeleccionada(null)
    setHoraSeleccionada(null)
  }

  if (cargandoNegocio) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>
  }

  if (!negocio) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Negocio no encontrado.
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Reservar en {negocio.nombre}</h1>
          <Link to={`/${slug}`} className="text-sm text-slate-500 underline">
            Volver
          </Link>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-slate-500">1. Elegí un servicio</h2>
          {servicios.length === 0 ? (
            <p className="text-slate-500 text-sm">Este negocio todavía no tiene servicios cargados.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {servicios.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => elegirServicio(s.id)}
                  className={`text-left border rounded-lg p-4 bg-white ${
                    servicioId === s.id ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-200'
                  }`}
                >
                  <p className="font-medium text-slate-800">{s.nombre}</p>
                  {s.descripcion && <p className="text-sm text-slate-500">{s.descripcion}</p>}
                  <p className="text-sm text-slate-600 mt-1">
                    ${s.precio} · {s.duracion_minutos} min
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {servicioId && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">2. Elegí un estilista (opcional)</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => elegirEstilista('')}
                className={`border rounded-full px-4 py-2 text-sm bg-white ${
                  estilistaId === '' ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-200'
                }`}
              >
                Cualquiera disponible
              </button>
              {estilistas.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => elegirEstilista(e.id)}
                  className={`border rounded-full px-4 py-2 text-sm bg-white ${
                    estilistaId === e.id ? 'border-slate-800 ring-1 ring-slate-800' : 'border-slate-200'
                  }`}
                >
                  {e.nombre}
                </button>
              ))}
            </div>
          </section>
        )}

        {servicioId && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">3. Elegí una fecha</h2>
            {cargandoDias && <p className="text-slate-400 text-xs">Actualizando disponibilidad...</p>}
            <Calendario
              mesReferencia={mesReferencia}
              fechasDisponibles={fechasDisponibles}
              fechaSeleccionada={fechaSeleccionada}
              onSeleccionar={setFechaSeleccionada}
              onCambiarMes={cambiarMes}
            />
          </section>
        )}

        {fechaSeleccionada && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium text-slate-500">4. Elegí un horario</h2>
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
          </section>
        )}

        {horaSeleccionada && (
          <p className="text-sm text-slate-600">
            Elegiste el {fechaSeleccionada} a las {horaSeleccionada.hora_inicio.slice(0, 5)}.
          </p>
        )}
      </div>
    </div>
  )
}
