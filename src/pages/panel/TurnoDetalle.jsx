import { useState } from 'react'
import EstadoBadge from './EstadoBadge.jsx'
import { marcarTurnoCompletado, cancelarTurnoPanel } from '../../lib/turnoApi'
import { hoyISO } from '../../lib/fechas'

function Campo({ etiqueta, valor }) {
  if (!valor) return null
  return (
    <div className="text-sm">
      <span className="font-medium text-slate-600">{etiqueta}: </span>
      <span className="text-slate-800">{valor}</span>
    </div>
  )
}

export default function TurnoDetalle({ turno, onCerrar, onActualizado }) {
  const [guardando, setGuardando] = useState(false)
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false)
  const [error, setError] = useState(null)

  if (!turno) return null

  async function ejecutar(accion) {
    setError(null)
    setGuardando(true)
    try {
      await accion(turno.id)
      onActualizado?.()
    } catch (err) {
      setError(err.message ?? 'No se pudo actualizar el turno')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      onClick={onCerrar}
    >
      <div
        className="bg-white rounded-lg shadow p-6 max-w-md w-full space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Detalle del turno</h2>
          <EstadoBadge estado={turno.estado} />
        </div>

        {turno.origen === 'panel' && (
          <span className="inline-block text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">
            Cargado desde el panel
          </span>
        )}

        <div className="space-y-1">
          <Campo etiqueta="Servicio" valor={turno.servicio?.nombre} />
          <Campo etiqueta="Estilista" valor={turno.estilista?.nombre ?? 'Cualquiera disponible'} />
          <Campo etiqueta="Fecha" valor={turno.fecha} />
          <Campo etiqueta="Hora" valor={`${turno.hora_inicio} - ${turno.hora_fin}`} />
          <Campo etiqueta="Monto" valor={`$${turno.monto}`} />
          <Campo etiqueta="Cliente" valor={turno.cliente_nombre} />
          <Campo etiqueta="Email" valor={turno.cliente_email} />
          <Campo etiqueta="Teléfono" valor={turno.cliente_telefono} />
          <Campo etiqueta="Nota" valor={turno.nota} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {turno.estado === 'confirmado' && !confirmandoCancelacion && (
          <>
            <button
              onClick={() => ejecutar(marcarTurnoCompletado)}
              disabled={guardando}
              className="w-full border border-slate-200 text-slate-700 rounded-xl px-4 py-2.5 font-medium hover:bg-slate-50 transition disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Marcar como completado'}
            </button>
            <button
              onClick={() => setConfirmandoCancelacion(true)}
              disabled={guardando}
              className="w-full border border-red-200 text-red-600 rounded-xl px-4 py-2.5 font-medium hover:bg-red-50 transition disabled:opacity-50"
            >
              Cancelar turno
            </button>
          </>
        )}

        {turno.estado === 'confirmado' && confirmandoCancelacion && (
          <div className="border border-red-200 bg-red-50 rounded-xl p-3 space-y-2">
            <p className="text-sm text-red-700">
              ¿Seguro que querés cancelar este turno?
              {!turno.cliente_email
                ? ' El cliente no tiene email: avisale por otro medio.'
                : turno.fecha >= hoyISO()
                  ? ' Se le avisará al cliente por email.'
                  : ''}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmandoCancelacion(false)}
                disabled={guardando}
                className="flex-1 border border-slate-200 bg-white text-slate-700 rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-50 transition disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={() => ejecutar(cancelarTurnoPanel)}
                disabled={guardando}
                className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
              >
                {guardando ? 'Cancelando...' : 'Sí, cancelar'}
              </button>
            </div>
          </div>
        )}

        <button onClick={onCerrar} className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition">
          Cerrar
        </button>
      </div>
    </div>
  )
}
