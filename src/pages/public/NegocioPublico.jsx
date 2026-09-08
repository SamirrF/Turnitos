import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { obtenerNegocioPorSlug } from '../../lib/publicoApi'

export default function NegocioPublico() {
  const { slug } = useParams()
  const [negocio, setNegocio] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activo = true
    setCargando(true)
    obtenerNegocioPorSlug(slug)
      .then((data) => {
        if (activo) setNegocio(data)
      })
      .catch((err) => activo && setError(err.message))
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [slug])

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Cargando...</div>
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>
  }

  if (!negocio) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Negocio no encontrado.
      </div>
    )
  }

  const redes = negocio.redes_sociales ?? {}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg shadow-slate-200 border border-slate-100 p-8 space-y-4 text-center">
        {negocio.logo_url && (
          <img src={negocio.logo_url} alt={negocio.nombre} className="w-24 h-24 mx-auto rounded-full object-cover ring-4 ring-indigo-50" />
        )}
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{negocio.nombre}</h1>
        {negocio.descripcion && <p className="text-slate-600">{negocio.descripcion}</p>}

        <div className="text-sm text-slate-500 space-y-1">
          {negocio.direccion && <p>{negocio.direccion}</p>}
          {negocio.telefono && <p>{negocio.telefono}</p>}
          {(redes.instagram || redes.facebook || redes.whatsapp) && (
            <p className="flex justify-center gap-3 pt-1">
              {redes.instagram && <span>Instagram: {redes.instagram}</span>}
              {redes.facebook && <span>Facebook: {redes.facebook}</span>}
              {redes.whatsapp && <span>WhatsApp: {redes.whatsapp}</span>}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <Link
            to={`/${slug}/reservar`}
            className="block bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition"
          >
            Nuevo turno
          </Link>
          <Link to={`/${slug}/mi-turno`} className="block text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
            Ver o modificar turno
          </Link>
        </div>
      </div>
    </div>
  )
}
