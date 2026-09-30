import { useEffect, useState } from 'react'
import { actualizarNegocio } from '../../lib/negocioApi'
import { LOGO_TIPOS, subirLogo, validarLogo } from '../../lib/storageApi'

export default function PasoDatosNegocio({
  negocio,
  onCompletado,
  titulo = 'Paso 1 de 4 · Datos del negocio',
  textoBoton = 'Siguiente',
}) {
  const [logoUrl, setLogoUrl] = useState(negocio.logo_url ?? '')
  const [logoArchivo, setLogoArchivo] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [descripcion, setDescripcion] = useState(negocio.descripcion ?? '')
  const [instagram, setInstagram] = useState(negocio.redes_sociales?.instagram ?? '')
  const [facebook, setFacebook] = useState(negocio.redes_sociales?.facebook ?? '')
  const [whatsapp, setWhatsapp] = useState(negocio.redes_sociales?.whatsapp ?? '')
  const [direccion, setDireccion] = useState(negocio.direccion ?? '')
  const [telefono, setTelefono] = useState(negocio.telefono ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!logoArchivo) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoArchivo)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoArchivo])

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const errorLogo = validarLogo(file)
    if (errorLogo) {
      setError(errorLogo)
      return
    }
    setError(null)
    setLogoArchivo(file)
  }

  function quitarLogo() {
    setLogoArchivo(null)
    setLogoUrl('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const logoFinal = logoArchivo ? await subirLogo(negocio.id, logoArchivo) : logoUrl
      const actualizado = await actualizarNegocio(negocio.id, {
        logo_url: logoFinal || null,
        descripcion: descripcion || null,
        redes_sociales: { instagram, facebook, whatsapp },
        direccion: direccion || null,
        telefono: telefono || null,
      })
      setLogoArchivo(null)
      setLogoUrl(actualizado.logo_url ?? '')
      onCompletado(actualizado)
    } catch (err) {
      setError(err.message ?? 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">{titulo}</h2>

      <div>
        <span className="block text-sm font-medium text-slate-700">Logo (opcional)</span>
        <div className="mt-2 flex items-center gap-4">
          {logoPreview || logoUrl ? (
            <img
              src={logoPreview || logoUrl}
              alt="Logo del negocio"
              className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-50 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-400 shrink-0">
              Sin logo
            </div>
          )}
          <div className="space-y-1">
            <label className="inline-block cursor-pointer px-3 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 transition">
              {logoPreview || logoUrl ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept={LOGO_TIPOS.join(',')} onChange={handleLogoChange} className="hidden" />
            </label>
            {(logoPreview || logoUrl) && (
              <button type="button" onClick={quitarLogo} className="block text-sm text-slate-500 hover:text-red-600 transition">
                Quitar logo
              </button>
            )}
            <p className="text-xs text-slate-400">PNG, JPG o WEBP, hasta 2 MB.</p>
          </div>
        </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        {guardando ? 'Guardando...' : textoBoton}
      </button>
    </form>
  )
}
