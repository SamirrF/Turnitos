import { supabase } from './supabaseClient'

export const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp']
export const LOGO_MAX_BYTES = 2 * 1024 * 1024

const EXTENSIONES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

export function validarLogo(file) {
  if (!LOGO_TIPOS.includes(file.type)) return 'El logo tiene que ser PNG, JPG o WEBP.'
  if (file.size > LOGO_MAX_BYTES) return 'El logo no puede pesar más de 2 MB.'
  return null
}

// Sube a logos/<negocio_id>/logo-<timestamp>.<ext> y devuelve la URL pública.
// Nombre nuevo en cada subida: evita que el navegador/CDN sirva el logo viejo
// cacheado y no requiere policy de UPDATE en el bucket.
export async function subirLogo(negocioId, file) {
  const path = `${negocioId}/logo-${Date.now()}.${EXTENSIONES[file.type]}`
  const { error } = await supabase.storage.from('logos').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
}
