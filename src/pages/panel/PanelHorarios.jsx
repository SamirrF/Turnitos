import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  actualizarNegocio,
  listarDiasNoLaborables,
  crearDiaNoLaborable,
  eliminarDiaNoLaborable,
} from '../../lib/negocioApi'
import HorarioSemanal, { horarioValido } from '../onboarding/HorarioSemanal.jsx'
import { hoyISO } from '../../lib/fechas'

export default function PanelHorarios() {
  const { negocio, setNegocio } = useOutletContext()
  const [horario, setHorario] = useState(negocio.horario_atencion ?? {})
  const [guardandoHorario, setGuardandoHorario] = useState(false)
  const [horarioGuardado, setHorarioGuardado] = useState(false)
  const [errorHorario, setErrorHorario] = useState(null)

  const [dias, setDias] = useState([])
  const [cargandoDias, setCargandoDias] = useState(true)
  const [nuevaFecha, setNuevaFecha] = useState(hoyISO())
  const [nuevoMotivo, setNuevoMotivo] = useState('')
  const [errorDia, setErrorDia] = useState(null)
  const [guardandoDia, setGuardandoDia] = useState(false)

  async function cargarDias() {
    setCargandoDias(true)
    const data = await listarDiasNoLaborables(negocio.id)
    setDias(data)
    setCargandoDias(false)
  }

  useEffect(() => {
    cargarDias()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio.id])

  async function guardarHorario(e) {
    e.preventDefault()
    setErrorHorario(null)
    setHorarioGuardado(false)

    if (!horarioValido(horario)) {
      setErrorHorario('Hay franjas horarias inválidas: la hora de fin debe ser posterior a la de inicio')
      return
    }

    setGuardandoHorario(true)
    try {
      const actualizado = await actualizarNegocio(negocio.id, { horario_atencion: horario })
      setNegocio(actualizado)
      setHorarioGuardado(true)
    } catch (err) {
      setErrorHorario(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardandoHorario(false)
    }
  }

  async function agregarDiaNoLaborable(e) {
    e.preventDefault()
    setErrorDia(null)
    setGuardandoDia(true)
    try {
      await crearDiaNoLaborable(negocio.id, { fecha: nuevaFecha, motivo: nuevoMotivo })
      setNuevoMotivo('')
      await cargarDias()
    } catch (err) {
      if (err.code === '23505') {
        setErrorDia('Ya marcaste esa fecha como no laborable')
      } else {
        setErrorDia(err.message ?? 'No se pudo guardar')
      }
    } finally {
      setGuardandoDia(false)
    }
  }

  async function quitarDiaNoLaborable(id) {
    await eliminarDiaNoLaborable(id)
    await cargarDias()
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-800">Horarios</h1>

      <form onSubmit={guardarHorario} className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-slate-500">Horario de atención general</h2>
        <HorarioSemanal value={horario} onChange={setHorario} />
        {errorHorario && <p className="text-red-600 text-sm">{errorHorario}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={guardandoHorario}
            className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {guardandoHorario ? 'Guardando...' : 'Guardar horario'}
          </button>
          {horarioGuardado && <span className="text-sm text-green-600">Guardado</span>}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-sm font-medium text-slate-500">Días no laborables puntuales</h2>

        <form onSubmit={agregarDiaNoLaborable} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Fecha</label>
            <input
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="mt-1 border rounded px-3 py-2"
              required
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-slate-700">Motivo (opcional)</label>
            <input
              type="text"
              value={nuevoMotivo}
              onChange={(e) => setNuevoMotivo(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Feriado, cierre excepcional..."
            />
          </div>
          <button
            type="submit"
            disabled={guardandoDia}
            className="bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {guardandoDia ? 'Agregando...' : 'Agregar'}
          </button>
        </form>

        {errorDia && <p className="text-red-600 text-sm">{errorDia}</p>}

        {cargandoDias ? (
          <p className="text-slate-500">Cargando...</p>
        ) : dias.length === 0 ? (
          <p className="text-slate-500">No hay días no laborables marcados.</p>
        ) : (
          <ul className="space-y-2">
            {dias.map((d) => (
              <li key={d.id} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-sm text-slate-700">
                  {d.fecha}
                  {d.motivo && <span className="text-slate-500"> · {d.motivo}</span>}
                </span>
                <button
                  onClick={() => quitarDiaNoLaborable(d.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
