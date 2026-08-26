import { supabase } from './supabaseClient'

export async function listarNegocios() {
  const { data, error } = await supabase
    .from('negocio')
    .select('id, nombre, slug, estado, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function contarNegocios() {
  const { count, error } = await supabase.from('negocio').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function contarTurnos() {
  const { count, error } = await supabase.from('turno').select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}
