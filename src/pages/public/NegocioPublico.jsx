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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4 text-center">
        {negocio.logo_url && (
          <img src={negocio.logo_url} alt={negocio.nombre} className="w-20 h-20 mx-auto rounded-full object-cover" />
        )}
        <h1 className="text-2xl font-semibold text-slate-800">{negocio.nombre}</h1>
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
            className="block bg-slate-800 text-white rounded px-4 py-2"
          >
            Nuevo turno
          </Link>
          <Link to={`/${slug}/mi-turno`} className="block text-sm text-slate-500 underline">
            Ver o modificar turno
          </Link>
        </div>
      </div>
    </div>
  )
}
