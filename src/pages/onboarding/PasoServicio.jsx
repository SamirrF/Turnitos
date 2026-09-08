import { useEffect, useState } from 'react'
import { crearServicio, listarServicios } from '../../lib/negocioApi'

export default function PasoServicio({ negocio, onCompletado }) {
  const [cargando, setCargando] = useState(true)
  const [servicioExistente, setServicioExistente] = useState(null)
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [precio, setPrecio] = useState('')
  const [duracion, setDuracion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    listarServicios(negocio.id)
      .then((servicios) => {
        if (activo) setServicioExistente(servicios[0] ?? null)
      })
      .catch(() => {
        if (activo) setServicioExistente(null)
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

    if (!nombre.trim()) return setError('El nombre del servicio es obligatorio')

    const precioNum = Number(precio)
    const duracionNum = Number(duracion)

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      return setError('El precio debe ser un número mayor o igual a 0')
    }
    if (!Number.isInteger(duracionNum) || duracionNum <= 0) {
      return setError('La duración debe ser un número entero mayor a 0')
    }

    setGuardando(true)
    try {
      await crearServicio(negocio.id, {
        nombre,
        descripcion: descripcion || null,
        precio: precioNum,
        duracion_minutos: duracionNum,
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

  if (servicioExistente) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Paso 3 de 4 · Tu primer servicio</h2>
        <div className="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
          <p className="font-medium text-slate-800">{servicioExistente.nombre}</p>
          {servicioExistente.descripcion && (
            <p className="text-sm text-slate-600">{servicioExistente.descripcion}</p>
          )}
          <p className="text-sm text-slate-600">
            ${servicioExistente.precio} · {servicioExistente.duracion_minutos} min
          </p>
        </div>
        <button
          type="button"
          onClick={() => onCompletado()}
          className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition"
        >
          Siguiente
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Paso 3 de 4 · Tu primer servicio</h2>

      <div>
        <label className="block text-sm font-medium text-slate-700">Nombre</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Descripción</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Precio</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Duración (minutos)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
          />
        </div>
      </div>

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
