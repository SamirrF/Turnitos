import { Link } from 'react-router-dom'

export default function ConfirmacionTurno({ turno, negocio, servicio, estilista, slug }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-slate-800">¡Turno confirmado!</h1>
        <p className="text-slate-500 text-sm">Guardá esta información.</p>
      </div>

      <dl className="text-sm space-y-1">
        <p>
          <span className="font-medium text-slate-600">Negocio: </span>
          {negocio.nombre}
        </p>
        <p>
          <span className="font-medium text-slate-600">Servicio: </span>
          {servicio?.nombre} (${turno.monto})
        </p>
        <p>
          <span className="font-medium text-slate-600">Estilista: </span>
          {estilista?.nombre ?? 'A confirmar'}
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
          <span className="font-medium text-slate-600">A nombre de: </span>
          {turno.cliente_nombre}
        </p>
      </dl>

      <div className="border rounded p-3 bg-slate-50">
        <p className="text-sm text-slate-600">
          Te enviamos un email con este código a {turno.cliente_email}. Igual, guardalo por las dudas — lo vas
          a necesitar para ver o modificar tu turno:
        </p>
        <p className="font-mono text-sm text-slate-800 break-all">{turno.token_gestion}</p>
      </div>

      <Link to={`/${slug}`} className="block text-center text-sm text-slate-500 underline">
        Volver al inicio
      </Link>
    </div>
  )
}
