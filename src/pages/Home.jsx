import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-slate-50 to-slate-100 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 flex items-center justify-center text-white text-2xl font-bold">
        T
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Turnitos</h1>
        <p className="text-slate-500">Reservá turnos online, sin vueltas.</p>
      </div>
      <div className="flex flex-col items-center gap-3 pt-2">
        <Link
          to="/registro"
          className="bg-indigo-600 text-white rounded-xl px-6 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition"
        >
          Registrar mi negocio
        </Link>
        <Link to="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition">
          Ya tengo una cuenta
        </Link>
      </div>
    </div>
  )
}
