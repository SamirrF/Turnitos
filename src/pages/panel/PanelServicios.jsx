import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listarServicios, crearServicio, actualizarServicio } from '../../lib/negocioApi'

const FORM_VACIO = { nombre: '', descripcion: '', precio: '', duracion_minutos: '' }

export default function PanelServicios() {
  const { negocio } = useOutletContext()
  const [servicios, setServicios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function cargarServicios() {
    setCargando(true)
    const data = await listarServicios(negocio.id)
    setServicios(data)
    setCargando(false)
  }

  useEffect(() => {
    cargarServicios()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio.id])

  function iniciarEdicion(servicio) {
    setEditandoId(servicio.id)
    setForm({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion ?? '',
      precio: String(servicio.precio),
      duracion_minutos: String(servicio.duracion_minutos),
    })
    setError(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setForm(FORM_VACIO)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!form.nombre.trim()) return setError('El nombre del servicio es obligatorio')

    const precioNum = Number(form.precio)
    const duracionNum = Number(form.duracion_minutos)

    if (!Number.isFinite(precioNum) || precioNum < 0) {
      return setError('El precio debe ser un número mayor o igual a 0')
    }
    if (!Number.isInteger(duracionNum) || duracionNum <= 0) {
      return setError('La duración debe ser un número entero mayor a 0')
    }

    const patch = {
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      precio: precioNum,
      duracion_minutos: duracionNum,
    }

    setGuardando(true)
    try {
      if (editandoId) {
        await actualizarServicio(editandoId, patch)
      } else {
        await crearServicio(negocio.id, patch)
      }
      cancelarEdicion()
      await cargarServicios()
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(servicio) {
    await actualizarServicio(servicio.id, { activo: !servicio.activo })
    await cargarServicios()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Servicios</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-500">
            {editandoId ? 'Editar servicio' : 'Nuevo servicio'}
          </h2>

          <div>
            <label className="block text-sm font-medium text-slate-700">Nombre</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Precio</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
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
                value={form.duracion_minutos}
                onChange={(e) => setForm({ ...form, duracion_minutos: e.target.value })}
                className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar servicio'}
            </button>
            {editandoId && (
              <button type="button" onClick={cancelarEdicion} className="text-slate-500 px-4 py-2.5 rounded-xl hover:bg-slate-100 transition">
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-medium text-slate-500 mb-2">Tus servicios</h2>
        {cargando ? (
          <p className="text-slate-500">Cargando...</p>
        ) : servicios.length === 0 ? (
          <p className="text-slate-500">Todavía no tenés servicios cargados.</p>
        ) : (
          <ul className="space-y-2">
            {servicios.map((s) => (
              <li key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 break-words">
                    {s.nombre}{' '}
                    {!s.activo && (
                      <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 ml-1">
                        Inactivo
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-600">
                    ${s.precio} · {s.duracion_minutos} min
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => iniciarEdicion(s)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                    Editar
                  </button>
                  <button onClick={() => toggleActivo(s)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                    {s.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
