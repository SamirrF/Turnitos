import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { registrarNegocio } from '../lib/negocioApi'
import { slugify, slugValido, slugDisponible } from '../lib/slug'
import { emailValido } from '../lib/validacion'

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
  // Con "Confirm email" activo en Supabase, signUp() no devuelve sesión:
  // pasamos a este paso, el usuario pega el código del mail y recién ahí
  // se crea el negocio (registrar_negocio exige auth.uid()).
  const [esperandoCodigo, setEsperandoCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [aviso, setAviso] = useState(null)

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
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

      // Email ya registrado y confirmado: según la config de Supabase llega
      // como error "already registered" o como user sin identities (anti-
      // enumeración). En ambos casos intentamos retomar con la contraseña.
      const yaRegistrado =
        signUpError?.message?.toLowerCase().includes('already registered') ||
        (!signUpError && data.user?.identities?.length === 0)

      if (signUpError && !yaRegistrado) throw signUpError

      if (yaRegistrado) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw new Error('Ese email ya está registrado. Si es tuyo, revisá la contraseña.')
      } else if (!data.session) {
        setCodigo('')
        setEsperandoCodigo(true)
        return
      }

      await completarRegistro()
    } catch (err) {
      setError(err.message ?? 'No se pudo completar el registro')
    } finally {
      setEnviando(false)
    }
  }

  async function completarRegistro() {
    await registrarNegocio({ nombre, slug, email })
    navigate('/onboarding')
  }

  async function handleVerificar(e) {
    e.preventDefault()
    setError(null)
    setAviso(null)

    const token = codigo.trim()
    if (!/^\d{6,10}$/.test(token)) return setError('Ingresá el código numérico que te llegó por mail')

    setEnviando(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (verifyError) throw new Error('El código es incorrecto o ya venció')

      await completarRegistro()
    } catch (err) {
      setError(err.message ?? 'No se pudo completar el registro')
    } finally {
      setEnviando(false)
    }
  }

  async function handleReenviar() {
    setError(null)
    setAviso(null)
    setEnviando(true)
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
      if (resendError) throw resendError
      setAviso('Te enviamos un código nuevo')
    } catch (err) {
      setError(err.message ?? 'No se pudo reenviar el código')
    } finally {
      setEnviando(false)
    }
  }

  function volverAlFormulario() {
    setEsperandoCodigo(false)
    setError(null)
    setAviso(null)
  }

  if (esperandoCodigo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
        <form onSubmit={handleVerificar} className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h1 className="text-xl font-semibold text-slate-800">Confirmá tu email</h1>
          <p className="text-sm text-slate-600">
            Te enviamos un código a <span className="font-medium">{email}</span>. Pegalo acá para terminar de crear tu negocio.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700">Código</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              maxLength={10}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              autoFocus
              required
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}
          {aviso && <p className="text-green-600 text-sm">{aviso}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviando ? 'Verificando...' : 'Confirmar y crear negocio'}
          </button>

          <div className="flex justify-between text-sm text-slate-500">
            <button type="button" onClick={volverAlFormulario} disabled={enviando} className="underline disabled:opacity-50">
              Corregir datos
            </button>
            <button type="button" onClick={handleReenviar} disabled={enviando} className="underline disabled:opacity-50">
              Reenviar código
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">Registrá tu negocio</h1>

        <div>
          <label className="block text-sm font-medium text-slate-700">Nombre del negocio</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
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
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
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
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={enviando || disponibilidad === false}
          className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 font-medium shadow-sm shadow-indigo-200 hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
