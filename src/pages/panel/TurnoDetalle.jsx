import EstadoBadge from './EstadoBadge.jsx'

function Campo({ etiqueta, valor }) {
  if (!valor) return null
  return (
    <div className="text-sm">
      <span className="font-medium text-slate-600">{etiqueta}: </span>
      <span className="text-slate-800">{valor}</span>
    </div>
  )
}

export default function TurnoDetalle({ turno, onCerrar }) {
  if (!turno) return null

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

        <button onClick={onCerrar} className="w-full bg-slate-800 text-white rounded px-4 py-2">
          Cerrar
        </button>
      </div>
    </div>
  )
}
