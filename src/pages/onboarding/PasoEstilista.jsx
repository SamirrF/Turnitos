import { useEffect, useState } from 'react'
import { crearEstilista, listarEstilistas } from '../../lib/negocioApi'
import HorarioSemanal, { horarioValido } from './HorarioSemanal.jsx'

export default function PasoEstilista({ negocio, onCompletado }) {
  const [cargando, setCargando] = useState(true)
  const [estilistaExistente, setEstilistaExistente] = useState(null)
  const [nombre, setNombre] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [especialidad, setEspecialidad] = useState('')
  const [horario, setHorario] = useState(negocio.horario_atencion ?? {})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    listarEstilistas(negocio.id)
      .then((estilistas) => {
        if (activo) setEstilistaExistente(estilistas[0] ?? null)
      })
      .catch(() => {
        if (activo) setEstilistaExistente(null)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [negocio.id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) return setError('El nombre del estilista es obligatorio')
    if (!horarioValido(horario)) {
      return setError('Hay franjas horarias inválidas: la hora de fin debe ser posterior a la de inicio')
    }

    setGuardando(true)
    try {
      await crearEstilista(negocio.id, {
        nombre,
        foto_url: fotoUrl || null,
        especialidad: especialidad || null,
        horario_disponible: horario,
      })
      onCompletado()
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return <p className="text-slate-500">Cargando...</p>
  }

  if (estilistaExistente) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Paso 4 de 4 · Tu primer estilista</h2>
        <div className="border rounded px-4 py-3 bg-slate-50">
          <p className="font-medium text-slate-800">{estilistaExistente.nombre}</p>
          {estilistaExistente.especialidad && (
            <p className="text-sm text-slate-600">{estilistaExistente.especialidad}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCompletado()}
          className="w-full bg-slate-800 text-white rounded px-4 py-2"
        >
          Finalizar
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Paso 4 de 4 · Tu primer estilista</h2>

      <div>
        <label className="block text-sm font-medium text-slate-700">Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Foto (URL, opcional)</label>
        <input
          type="url"
          value={fotoUrl}
          onChange={(e) => setFotoUrl(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Especialidad (opcional)</label>
        <input
          type="text"
          value={especialidad}
          onChange={(e) => setEspecialidad(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Horario disponible</label>
        <HorarioSemanal value={horario} onChange={setHorario} />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={guardando}
        className="w-full bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {guardando ? 'Guardando...' : 'Finalizar'}
      </button>
    </form>
  )
}
