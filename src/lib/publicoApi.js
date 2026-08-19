import { supabase } from './supabaseClient'

export async function obtenerNegocioPorSlug(slug) {
  const { data, error } = await supabase.rpc('obtener_negocio_publico', { p_slug: slug })
  if (error) throw error
  return data?.[0] ?? null
}

export async function listarServiciosActivos(negocioId) {
  const { data, error } = await supabase
    .from('servicio')
    .select('*')
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listarEstilistasActivos(negocioId) {
  const { data, error } = await supabase
    .from('estilista')
    .select('*')
    .eq('negocio_id', negocioId)
    .eq('activo', true)
    .order('nombre', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function obtenerDiasDisponibles(negocioId, { desde, hasta, estilistaId }) {
  const { data, error } = await supabase.rpc('dias_disponibles', {
    p_negocio_id: negocioId,
    p_desde: desde,
    p_hasta: hasta,
    p_estilista_id: estilistaId || null,
  })
  if (error) throw error
  return data ?? []
}

export async function obtenerHorariosDisponibles(negocioId, servicioId, fecha, estilistaId) {
  const { data, error } = await supabase.rpc('horarios_disponibles', {
    p_negocio_id: negocioId,
    p_servicio_id: servicioId,
    p_fecha: fecha,
    p_estilista_id: estilistaId || null,
  })
  if (error) throw error
  return data ?? []
}
