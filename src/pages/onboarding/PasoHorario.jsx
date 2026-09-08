import { useState } from 'react'
import { actualizarNegocio } from '../../lib/negocioApi'
import HorarioSemanal, { horarioValido } from './HorarioSemanal.jsx'

export default function PasoHorario({ negocio, onCompletado }) {
  const [horario, setHorario] = useState(negocio.horario_atencion ?? {})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!horarioValido(horario)) {
      setError('Hay franjas horarias inválidas: la hora de fin debe ser posterior a la de inicio')
      return
    }

    setGuardando(true)
    try {
      const actualizado = await actualizarNegocio(negocio.id, { horario_atencion: horario })
      onCompletado(actualizado)
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Paso 2 de 4 · Horario de atención</h2>
      <HorarioSemanal value={horario} onChange={setHorario} />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={guardando}
        className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {guardando ? 'Guardando...' : 'Siguiente'}
      </button>
    </form>
  )
}
