import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-800">Turnitos</h1>
      <Link to="/registro" className="bg-slate-800 text-white rounded px-4 py-2">
        Registrar mi negocio
      </Link>
    </div>
  )
}
