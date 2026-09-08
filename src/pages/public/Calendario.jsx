import { inicioDeMes, finDeMes, sumarDias, hoyISO } from '../../lib/fechas'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function parseISO(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function nombreMes(fechaISO) {
  return parseISO(fechaISO).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export default function Calendario({ mesReferencia, fechasDisponibles, fechaSeleccionada, onSeleccionar, onCambiarMes }) {
  const inicioMes = inicioDeMes(mesReferencia)
  const finMes = finDeMes(mesReferencia)

  const diaSemanaInicio = parseISO(inicioMes).getDay() // 0 = domingo
  const offsetInicio = diaSemanaInicio === 0 ? 6 : diaSemanaInicio - 1
  const primerDiaGrilla = sumarDias(inicioMes, -offsetInicio)

  const diaSemanaFin = parseISO(finMes).getDay()
  const offsetFin = diaSemanaFin === 0 ? 0 : 7 - diaSemanaFin
  const ultimoDiaGrilla = sumarDias(finMes, offsetFin)

  const dias = []
  for (let cursor = primerDiaGrilla; cursor <= ultimoDiaGrilla; cursor = sumarDias(cursor, 1)) {
    dias.push(cursor)
  }

  const hoy = hoyISO()

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => onCambiarMes(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
        >
          ←
        </button>
        <span className="font-semibold text-slate-800 capitalize tracking-tight">{nombreMes(mesReferencia)}</span>
        <button
          type="button"
          onClick={() => onCambiarMes(1)}
          className="w-9 h-9 flex items-center justify-center rounded-full text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {dias.map((fecha) => {
          const enMes = fecha >= inicioMes && fecha <= finMes
          const esPasado = fecha < hoy
          const disponible = fechasDisponibles.has(fecha)
          const habilitado = enMes && disponible && !esPasado
          const seleccionado = fecha === fechaSeleccionada
          const esHoy = fecha === hoy

          return (
            <button
              type="button"
              key={fecha}
              disabled={!habilitado}
              onClick={() => onSeleccionar(fecha)}
              className={`relative aspect-square rounded-xl text-sm font-medium transition-all duration-150 ${
                !enMes ? 'text-slate-300' : habilitado ? 'text-slate-700' : 'text-slate-300'
              } ${habilitado ? 'hover:bg-indigo-50 hover:scale-105' : 'cursor-not-allowed'} ${
                esHoy && !seleccionado ? 'ring-1 ring-inset ring-indigo-300' : ''
              } ${seleccionado ? '!bg-indigo-600 !text-white shadow-md shadow-indigo-300 scale-105' : ''}`}
            >
              {Number(fecha.slice(-2))}
              {habilitado && !seleccionado && (
                <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
