import { useState } from 'react'
import { actualizarNegocio } from '../../lib/negocioApi'

export default function PasoDatosNegocio({ negocio, onCompletado }) {
  const [logoUrl, setLogoUrl] = useState(negocio.logo_url ?? '')
  const [descripcion, setDescripcion] = useState(negocio.descripcion ?? '')
  const [instagram, setInstagram] = useState(negocio.redes_sociales?.instagram ?? '')
  const [facebook, setFacebook] = useState(negocio.redes_sociales?.facebook ?? '')
  const [whatsapp, setWhatsapp] = useState(negocio.redes_sociales?.whatsapp ?? '')
  const [direccion, setDireccion] = useState(negocio.direccion ?? '')
  const [telefono, setTelefono] = useState(negocio.telefono ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const actualizado = await actualizarNegocio(negocio.id, {
        logo_url: logoUrl || null,
        descripcion: descripcion || null,
        redes_sociales: { instagram, facebook, whatsapp },
        direccion: direccion || null,
        telefono: telefono || null,
      })
      onCompletado(actualizado)
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Paso 1 de 4 · Datos del negocio</h2>

      <div>
        <label className="block text-sm font-medium text-slate-700">Logo (URL, opcional)</label>
        <input
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Descripción breve</label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Instagram</label>
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Facebook</label>
          <input
            type="text"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">WhatsApp</label>
          <input
            type="text"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Dirección</label>
        <input
          type="text"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Teléfono (opcional)</label>
        <input
          type="text"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        />
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
