import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listarEstilistas, crearEstilista, actualizarEstilista } from '../../lib/negocioApi'
import HorarioSemanal, { horarioValido } from '../onboarding/HorarioSemanal.jsx'

const FORM_VACIO = { nombre: '', foto_url: '', especialidad: '', horario_disponible: {} }

export default function PanelEstilistas() {
  const { negocio } = useOutletContext()
  const [estilistas, setEstilistas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function cargarEstilistas() {
    setCargando(true)
    const data = await listarEstilistas(negocio.id)
    setEstilistas(data)
    setCargando(false)
  }

  useEffect(() => {
    cargarEstilistas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio.id])

  function iniciarEdicion(estilista) {
    setEditandoId(estilista.id)
    setForm({
      nombre: estilista.nombre,
      foto_url: estilista.foto_url ?? '',
      especialidad: estilista.especialidad ?? '',
      horario_disponible: estilista.horario_disponible ?? {},
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

    if (!form.nombre.trim()) return setError('El nombre del estilista es obligatorio')
    if (!horarioValido(form.horario_disponible)) {
      return setError('Hay franjas horarias inválidas: la hora de fin debe ser posterior a la de inicio')
    }

    const patch = {
      nombre: form.nombre,
      foto_url: form.foto_url || null,
      especialidad: form.especialidad || null,
      horario_disponible: form.horario_disponible,
    }

    setGuardando(true)
    try {
      if (editandoId) {
        await actualizarEstilista(editandoId, patch)
      } else {
        await crearEstilista(negocio.id, patch)
      }
      cancelarEdicion()
      await cargarEstilistas()
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(estilista) {
    await actualizarEstilista(estilista.id, { activo: !estilista.activo })
    await cargarEstilistas()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Estilistas</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h2 className="text-sm font-medium text-slate-500">
            {editandoId ? 'Editar estilista' : 'Nuevo estilista'}
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
            <label className="block text-sm font-medium text-slate-700">Foto (URL, opcional)</label>
            <input
              type="url"
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Especialidad (opcional)</label>
            <input
              type="text"
              value={form.especialidad}
              onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Horario disponible</label>
            <HorarioSemanal
              value={form.horario_disponible}
              onChange={(horario) => setForm({ ...form, horario_disponible: horario })}
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar estilista'}
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
        <h2 className="text-sm font-medium text-slate-500 mb-2">Tus estilistas</h2>
        {cargando ? (
          <p className="text-slate-500">Cargando...</p>
        ) : estilistas.length === 0 ? (
          <p className="text-slate-500">Todavía no tenés estilistas cargados.</p>
        ) : (
          <ul className="space-y-2">
            {estilistas.map((est) => (
              <li key={est.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-800">
                    {est.nombre}{' '}
                    {!est.activo && (
                      <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 ml-1">
                        Inactivo
                      </span>
                    )}
                  </p>
                  {est.especialidad && <p className="text-sm text-slate-600">{est.especialidad}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => iniciarEdicion(est)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                    Editar
                  </button>
                  <button onClick={() => toggleActivo(est)} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
                    {est.activo ? 'Desactivar' : 'Activar'}
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
