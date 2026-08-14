import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { obtenerNegocioActual } from '../lib/negocioApi'
import PasoDatosNegocio from './onboarding/PasoDatosNegocio.jsx'
import PasoHorario from './onboarding/PasoHorario.jsx'
import PasoServicio from './onboarding/PasoServicio.jsx'
import PasoEstilista from './onboarding/PasoEstilista.jsx'

const PASOS = ['datos', 'horario', 'servicio', 'estilista', 'listo']

export default function Onboarding() {
  const navigate = useNavigate()
  const [negocio, setNegocio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [pasoIndex, setPasoIndex] = useState(0)

  useEffect(() => {
    let activo = true

    async function cargar() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        navigate('/registro')
        return
      }

      const negocioActual = await obtenerNegocioActual()
      if (!activo) return

      if (!negocioActual) {
        navigate('/registro')
        return
      }

      setNegocio(negocioActual)
      setCargando(false)
    }

    cargar()
    return () => {
      activo = false
    }
  }, [navigate])

  function irAlSiguientePaso(negocioActualizado) {
    if (negocioActualizado) setNegocio(negocioActualizado)
    setPasoIndex((i) => i + 1)
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>
  }

  const paso = PASOS[pasoIndex]

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-xl mx-auto bg-white rounded-lg shadow p-6">
        {paso === 'datos' && <PasoDatosNegocio negocio={negocio} onCompletado={irAlSiguientePaso} />}
        {paso === 'horario' && <PasoHorario negocio={negocio} onCompletado={irAlSiguientePaso} />}
        {paso === 'servicio' && <PasoServicio negocio={negocio} onCompletado={irAlSiguientePaso} />}
        {paso === 'estilista' && <PasoEstilista negocio={negocio} onCompletado={irAlSiguientePaso} />}
        {paso === 'listo' && (
          <div className="text-center space-y-2 py-8">
            <h1 className="text-xl font-semibold text-slate-800">¡Tu negocio ya está listo!</h1>
            <p className="text-slate-600">Ya podés empezar a recibir turnos.</p>
          </div>
        )}
      </div>
    </div>
  )
}
