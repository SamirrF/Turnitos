import { supabase } from './supabaseClient'

export async function listarTurnos(negocioId, { desde, hasta, estilistaId } = {}) {
  let query = supabase
    .from('turno')
    .select('*, servicio:servicio_id(nombre, duracion_minutos), estilista:estilista_id(nombre)')
    .eq('negocio_id', negocioId)
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)
  if (estilistaId) query = query.eq('estilista_id', estilistaId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}
