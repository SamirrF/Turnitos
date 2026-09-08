const ESTILOS = {
  confirmado: 'bg-blue-100 text-blue-700',
  cancelado: 'bg-red-100 text-red-700',
  completado: 'bg-green-100 text-green-700',
}

const ETIQUETAS = {
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  completado: 'Completado',
}

export default function EstadoBadge({ estado }) {
  const clase = ESTILOS[estado] ?? 'bg-slate-100 text-slate-600'
  const etiqueta = ETIQUETAS[estado] ?? estado
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${clase}`}>{etiqueta}</span>
}
