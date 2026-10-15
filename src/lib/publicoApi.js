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

// Crea uno o más turnos (hasta 4) del mismo servicio en la misma fecha.
// Todo o nada: si algún horario ya no está libre, no se crea ninguno.
export async function crearReserva({
  negocioId,
  servicioId,
  estilistaId,
  fecha,
  horas,
  clienteNombre,
  clienteEmail,
  clienteTelefono,
  nota,
  metodoPago,
}) {
  const { data, error } = await supabase.rpc('crear_reserva', {
    p_negocio_id: negocioId,
    p_servicio_id: servicioId,
    p_fecha: fecha,
    p_horas: horas,
    p_cliente_nombre: clienteNombre,
    p_cliente_email: clienteEmail,
    p_cliente_telefono: clienteTelefono,
    p_nota: nota || null,
    p_estilista_id: estilistaId || null,
    p_metodo_pago: metodoPago,
  })
  if (error) throw error
  return data ?? []
}

export async function obtenerTurnoPorToken(token) {
  const { data, error } = await supabase.rpc('obtener_turno_por_token', { p_token: token })
  if (error) throw error
  return data?.[0] ?? null
}

export async function cancelarTurno(token) {
  const { data, error } = await supabase.rpc('cancelar_turno', { p_token: token })
  if (error) throw error
  return data
}

export async function reprogramarTurno(token, fecha, horaInicio) {
  const { data, error } = await supabase.rpc('reprogramar_turno', {
    p_token: token,
    p_fecha: fecha,
    p_hora_inicio: horaInicio,
  })
  if (error) throw error
  return data
}

export async function solicitarRecuperacionTurno(email) {
  const { error } = await supabase.rpc('solicitar_recuperacion_turno', { p_email: email })
  if (error) throw error
}
