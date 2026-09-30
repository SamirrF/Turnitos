import { useEffect, useState } from 'react'
import { listarServicios, listarEstilistas } from '../../lib/negocioApi'
import { obtenerHorariosDisponibles } from '../../lib/publicoApi'
import { crearTurnoPanel } from '../../lib/turnoApi'
import { emailValido, telefonoValido } from '../../lib/validacion'
import { hoyISO, horaActualHHMM } from '../../lib/fechas'

const claseInput =
  'mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition'

export default function NuevoTurnoModal({ negocioId, fechaInicial, onCerrar, onCreado }) {
  const [servicios, setServicios] = useState([])
  const [estilistas, setEstilistas] = useState([])
  const [servicioId, setServicioId] = useState('')
  const [estilistaId, setEstilistaId] = useState('')
  const [fecha, setFecha] = useState(fechaInicial && fechaInicial >= hoyISO() ? fechaInicial : hoyISO())

  const [horarios, setHorarios] = useState([])
  const [cargandoHorarios, setCargandoHorarios] = useState(false)
  const [horaSeleccionada, setHoraSeleccionada] = useState(null)

  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteTelefono, setClienteTelefono] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [nota, setNota] = useState('')

  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([listarServicios(negocioId), listarEstilistas(negocioId)])
      .then(([s, e]) => {
        setServicios(s.filter((x) => x.activo))
        setEstilistas(e.filter((x) => x.activo))
      })
      .catch((err) => setError(err.message ?? 'No se pudieron cargar servicios y estilistas'))
  }, [negocioId])

  function cargarHorarios() {
    setHoraSeleccionada(null)
    if (!servicioId || !fecha) {
      setHorarios([])
      return
    }
    setCargandoHorarios(true)
    obtenerHorariosDisponibles(negocioId, servicioId, fecha, estilistaId)
      .then((data) => {
        setHorarios(fecha === hoyISO() ? data.filter((h) => h.hora_inicio > horaActualHHMM()) : data)
      })
      .catch((err) => setError(err.message ?? 'No se pudieron cargar los horarios'))
      .finally(() => setCargandoHorarios(false))
  }

  useEffect(() => {
    cargarHorarios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocioId, servicioId, estilistaId, fecha])

  async function guardar(e) {
    e.preventDefault()
    setError(null)

    if (!servicioId || !horaSeleccionada) {
      setError('Elegí un servicio, una fecha y un horario')
      return
    }
    if (!clienteNombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    if (!telefonoValido(clienteTelefono)) {
      setError('Teléfono inválido')
      return
    }
    if (clienteEmail.trim() && !emailValido(clienteEmail.trim())) {
      setError('Email inválido')
      return
    }

    setEnviando(true)
    try {
      const turno = await crearTurnoPanel({
        servicioId,
        estilistaId,
        fecha,
        horaInicio: horaSeleccionada.hora_inicio,
        clienteNombre: clienteNombre.trim(),
        clienteTelefono: clienteTelefono.trim(),
        clienteEmail: clienteEmail.trim(),
        nota: nota.trim(),
      })
      onCreado?.(turno)
    } catch (err) {
      const mensaje = err.message ?? 'No se pudo crear el turno'
      setError(mensaje)
      if (mensaje.includes('ya no está disponible')) cargarHorarios()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <form
        onSubmit={guardar}
        className="bg-white rounded-lg shadow p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-800">Nuevo turno</h2>

        <div>
          <label className="block text-sm font-medium text-slate-700">Servicio</label>
          <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} className={claseInput}>
            <option value="">Elegí un servicio</option>
            {servicios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre} · {s.duracion_minutos} min · ${s.precio}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Estilista</label>
          <select value={estilistaId} onChange={(e) => setEstilistaId(e.target.value)} className={claseInput}>
            <option value="">Cualquiera disponible</option>
            {estilistas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Fecha</label>
          <input
            type="date"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            className={claseInput}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Horario</label>
          {!servicioId ? (
            <p className="text-sm text-slate-500 mt-1">Elegí un servicio para ver los horarios libres.</p>
          ) : cargandoHorarios ? (
            <p className="text-sm text-slate-500 mt-1">Cargando horarios...</p>
          ) : horarios.length === 0 ? (
            <p className="text-sm text-slate-500 mt-1">No hay horarios libres ese día.</p>
          ) : (
            <div className="mt-1 grid grid-cols-4 sm:grid-cols-5 gap-2">
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

        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre del cliente</label>
          <input type="text" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={claseInput} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Teléfono</label>
          <input type="tel" value={clienteTelefono} onChange={(e) => setClienteTelefono(e.target.value)} className={claseInput} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email (opcional)</label>
          <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className={claseInput} />
          <p className="text-xs text-slate-500 mt-1">
            Si lo cargás, le llega la confirmación con un link para cancelar o reprogramar.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Nota (opcional)</label>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={claseInput} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="flex-1 border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-medium hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50"
          >
            {enviando ? 'Guardando...' : 'Crear turno'}
          </button>
        </div>
      </form>
    </div>
  )
}
