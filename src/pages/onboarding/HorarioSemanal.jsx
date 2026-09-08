const DIAS = [
  { key: 'lunes', label: 'Lunes' },
  { key: 'martes', label: 'Martes' },
  { key: 'miercoles', label: 'Miércoles' },
  { key: 'jueves', label: 'Jueves' },
  { key: 'viernes', label: 'Viernes' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
]

const FRANJA_DEFAULT = { inicio: '09:00', fin: '18:00' }

export function horarioValido(horario) {
  return Object.values(horario ?? {}).every((franjas) =>
    (franjas ?? []).every((f) => f.inicio < f.fin),
  )
}

export default function HorarioSemanal({ value, onChange }) {
  const horario = value ?? {}

  function setDia(dia, franjas) {
    onChange({ ...horario, [dia]: franjas })
  }

  function toggleAbierto(dia, abierto) {
    setDia(dia, abierto ? [FRANJA_DEFAULT] : [])
  }

  function setHora(dia, campo, valor) {
    const franja = horario[dia]?.[0] ?? FRANJA_DEFAULT
    setDia(dia, [{ ...franja, [campo]: valor }])
  }

  return (
    <div className="space-y-2">
      {DIAS.map(({ key, label }) => {
        const franjas = horario[key] ?? []
        const abierto = franjas.length > 0
        const franja = franjas[0] ?? FRANJA_DEFAULT
        return (
          <div key={key} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-32 shrink-0">
              <input type="checkbox" checked={abierto} onChange={(e) => toggleAbierto(key, e.target.checked)} />
              <span className="text-sm text-slate-700">{label}</span>
            </label>
            {abierto ? (
              <>
                <input
                  type="time"
                  value={franja.inicio}
                  onChange={(e) => setHora(key, 'inicio', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
                <span className="text-slate-400">a</span>
                <input
                  type="time"
                  value={franja.fin}
                  onChange={(e) => setHora(key, 'fin', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </>
            ) : (
              <span className="text-sm text-slate-400">Cerrado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
