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
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => onCambiarMes(-1)} className="px-2 py-1 text-slate-600">
          ←
        </button>
        <span className="font-medium text-slate-800 capitalize">{nombreMes(mesReferencia)}</span>
        <button type="button" onClick={() => onCambiarMes(1)} className="px-2 py-1 text-slate-600">
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-1">
        {DIAS_SEMANA.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((fecha) => {
          const enMes = fecha >= inicioMes && fecha <= finMes
          const esPasado = fecha < hoy
          const disponible = fechasDisponibles.has(fecha)
          const habilitado = enMes && disponible && !esPasado
          const seleccionado = fecha === fechaSeleccionada

          return (
            <button
              type="button"
              key={fecha}
              disabled={!habilitado}
              onClick={() => onSeleccionar(fecha)}
              className={`aspect-square rounded text-sm ${!enMes ? 'text-slate-300' : habilitado ? 'text-slate-800' : 'text-slate-300'} ${
                habilitado ? 'hover:bg-slate-100' : 'cursor-not-allowed'
              } ${seleccionado ? '!bg-slate-800 !text-white' : ''}`}
            >
              {Number(fecha.slice(-2))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
