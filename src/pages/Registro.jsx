import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { registrarNegocio } from '../lib/negocioApi'
import { slugify, slugValido, slugDisponible } from '../lib/slug'

function emailValido(valor) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)
}

export default function Registro() {
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEditadoManualmente, setSlugEditadoManualmente] = useState(false)
  const [disponibilidad, setDisponibilidad] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slugEditadoManualmente) {
      setSlug(slugify(nombre))
    }
  }, [nombre, slugEditadoManualmente])

  useEffect(() => {
    if (!slug || !slugValido(slug)) {
      setDisponibilidad(null)
      return
    }
    setDisponibilidad('checking')
    const timeout = setTimeout(async () => {
      try {
        const disponible = await slugDisponible(slug)
        setDisponibilidad(disponible)
      } catch {
        setDisponibilidad(null)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [slug])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!nombre.trim()) return setError('El nombre del negocio es obligatorio')
    if (!emailValido(email)) return setError('Ingresá un email válido')
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (!slugValido(slug)) return setError('El slug elegido no es válido')

    setEnviando(true)
    try {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })

      if (signUpError) {
        const yaRegistrado = signUpError.message?.toLowerCase().includes('already registered')
        if (!yaRegistrado) throw signUpError

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }

      await registrarNegocio({ nombre, slug, email })
      navigate('/onboarding')
    } catch (err) {
      setError(err.message ?? 'No se pudo completar el registro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-lg shadow p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">Registrá tu negocio</h1>

        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre del negocio</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Slug (URL)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugEditadoManualmente(true)
              setSlug(e.target.value)
            }}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
          <p className="text-sm mt-1 text-slate-500">
            turnitos.com/{slug || '...'}{' '}
            {disponibilidad === 'checking' && <span className="text-slate-400">verificando...</span>}
            {disponibilidad === true && <span className="text-green-600">disponible</span>}
            {disponibilidad === false && <span className="text-red-600">ya está en uso</span>}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={enviando || disponibilidad === false}
          className="w-full bg-slate-800 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {enviando ? 'Registrando...' : 'Registrarme'}
        </button>

        <p className="text-sm text-slate-500">
          <Link to="/" className="underline">
            Volver al inicio
          </Link>
        </p>
      </form>
    </div>
  )
}
