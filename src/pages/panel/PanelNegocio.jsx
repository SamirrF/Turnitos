import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import PasoDatosNegocio from '../onboarding/PasoDatosNegocio.jsx'

export default function PanelNegocio() {
  const { negocio, setNegocio } = useOutletContext()
  const [guardado, setGuardado] = useState(false)

  function handleGuardado(actualizado) {
    setNegocio(actualizado)
    setGuardado(true)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-800">Mi negocio</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <PasoDatosNegocio
          negocio={negocio}
          onCompletado={handleGuardado}
          titulo="Datos del negocio"
          textoBoton="Guardar"
        />
        {guardado && <p className="text-sm text-green-600">Guardado</p>}
      </div>
    </div>
  )
}
