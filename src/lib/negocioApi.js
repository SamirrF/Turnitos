import { supabase } from './supabaseClient'

export async function registrarNegocio({ nombre, slug, email }) {
  const { data, error } = await supabase.rpc('registrar_negocio', {
    p_nombre: nombre,
    p_slug: slug,
    p_email: email,
  })
  if (error) throw error
  return data
}

export async function obtenerNegocioActual() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: usuarioNegocio } = await supabase
    .from('usuario_negocio')
    .select('negocio_id')
    .eq('id', user.id)
    .single()

  if (!usuarioNegocio) return null

  const { data: negocio } = await supabase
    .from('negocio')
    .select('*')
    .eq('id', usuarioNegocio.negocio_id)
    .single()

  return negocio ?? null
}

export async function actualizarNegocio(negocioId, patch) {
  const { data, error } = await supabase
    .from('negocio')
    .update(patch)
    .eq('id', negocioId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listarServicios(negocioId) {
  const { data, error } = await supabase
    .from('servicio')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function crearServicio(negocioId, servicio) {
  const { data, error } = await supabase
    .from('servicio')
    .insert({ negocio_id: negocioId, ...servicio })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function listarEstilistas(negocioId) {
  const { data, error } = await supabase
    .from('estilista')
    .select('*')
    .eq('negocio_id', negocioId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function crearEstilista(negocioId, estilista) {
  const { data, error } = await supabase
    .from('estilista')
    .insert({ negocio_id: negocioId, ...estilista })
    .select()
    .single()
  if (error) throw error
  return data
}
