import { supabase } from './supabaseClient'

const MAPA_ACENTOS = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }

export function slugify(nombre) {
  const base = (nombre ?? '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[áéíóúüñ]/g, (c) => MAPA_ACENTOS[c] ?? c)

  return base
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugValido(slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
}

export async function slugDisponible(slug) {
  const { data, error } = await supabase.rpc('slug_disponible', { p_slug: slug })
  if (error) throw error
  return data
}
