import { Link } from 'react-router-dom'
import { etiquetaMetodoPago } from '../../lib/metodosPago'

// turnos: los turnos de una misma reserva (mismo servicio, fecha y cliente).
export default function ConfirmacionTurno({ turnos, negocio, servicio, estilistas, slug }) {
  const primero = turnos[0]
  const varios = turnos.length > 1
  const total = turnos.reduce((suma, t) => suma + Number(t.monto), 0)
  const nombreEstilista = (id) => estilistas.find((e) => e.id === id)?.nombre ?? 'A confirmar'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold text-slate-800">
          {varios ? `¡${turnos.length} turnos confirmados!` : '¡Turno confirmado!'}
        </h1>
        <p className="text-slate-500 text-sm">Guardá esta información.</p>
      </div>

      <dl className="text-sm space-y-1">
        <p>
          <span className="font-medium text-slate-600">Negocio: </span>
          {negocio.nombre}
        </p>
        <p>
          <span className="font-medium text-slate-600">Servicio: </span>
          {servicio?.nombre} (${primero.monto}
          {varios && ' c/u'})
        </p>
        {!varios && (
          <p>
            <span className="font-medium text-slate-600">Estilista: </span>
            {nombreEstilista(primero.estilista_id)}
          </p>
        )}
        <p>
          <span className="font-medium text-slate-600">Fecha: </span>
          {primero.fecha}
        </p>
        {!varios && (
          <p>
            <span className="font-medium text-slate-600">Hora: </span>
            {primero.hora_inicio.slice(0, 5)} - {primero.hora_fin.slice(0, 5)}
          </p>
        )}
        {varios && (
          <p>
            <span className="font-medium text-slate-600">Total: </span>${total}
          </p>
        )}
        {primero.metodo_pago && (
          <p>
            <span className="font-medium text-slate-600">Método de pago: </span>
            {etiquetaMetodoPago(primero.metodo_pago)}
          </p>
        )}
        <p>
          <span className="font-medium text-slate-600">A nombre de: </span>
          {primero.cliente_nombre}
        </p>
      </dl>

      <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
        <p className="text-sm text-slate-600">
          Te enviamos un email a {primero.cliente_email} con{' '}
          {varios ? 'un código por cada turno' : 'este código'}. Igual, guardalo por las dudas — lo vas a
          necesitar para ver o modificar {varios ? 'cada turno' : 'tu turno'}:
        </p>
        {varios ? (
          <ul className="space-y-2">
            {turnos.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="text-slate-700">
                  <span className="font-medium">
                    {t.hora_inicio.slice(0, 5)} - {t.hora_fin.slice(0, 5)}
                  </span>{' '}
                  · {nombreEstilista(t.estilista_id)}
                </p>
                <p className="font-mono text-slate-800 break-all">{t.token_gestion}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-mono text-sm text-slate-800 break-all">{primero.token_gestion}</p>
        )}
      </div>

      <Link to={`/${slug}`} className="block text-center text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
        Volver al inicio
      </Link>
    </div>
  )
}
