import { useParams, Link } from 'react-router-dom'

export default function MiTurnoPlaceholder() {
  const { slug } = useParams()

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-3">
        <p className="text-slate-600">Esta función estará disponible próximamente.</p>
        <Link to={`/${slug}`} className="text-sm text-slate-500 underline">
          Volver
        </Link>
      </div>
    </div>
  )
}
