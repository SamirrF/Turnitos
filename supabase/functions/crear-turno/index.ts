import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { corsHeaders } from '../_shared/cors.ts'

// horario_atencion / horario_disponible: { "lunes": [{ "inicio": "09:00", "fin": "18:00" }], ... }
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function dentroDeFranjas(inicio: string, fin: string, franjas: { inicio: string; fin: string }[]): boolean {
  return franjas.some((f) => inicio >= f.inicio && fin <= f.fin)
}

function seSuperponen(aIni: string, aFin: string, bIni: string, bFin: string): boolean {
  return aIni < bFin && bIni < aFin
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      negocio_id,
      servicio_id,
      estilista_id = null,
      fecha,
      hora_inicio,
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      nota = null,
    } = await req.json()

    if (!negocio_id || !servicio_id || !fecha || !hora_inicio || !cliente_nombre || !cliente_email || !cliente_telefono) {
      return jsonResponse({ error: 'Faltan campos obligatorios' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: negocio, error: negocioError } = await supabase
      .from('negocio')
      .select('id, estado, horario_atencion')
      .eq('id', negocio_id)
      .single()

    if (negocioError || !negocio || negocio.estado !== 'activo') {
      return jsonResponse({ error: 'Negocio no disponible' }, 404)
    }

    const { data: servicio, error: servicioError } = await supabase
      .from('servicio')
      .select('id, negocio_id, precio, duracion_minutos, activo')
      .eq('id', servicio_id)
      .single()

    if (servicioError || !servicio || !servicio.activo || servicio.negocio_id !== negocio_id) {
      return jsonResponse({ error: 'Servicio no disponible' }, 404)
    }

    const hora_fin = sumarMinutos(hora_inicio, servicio.duracion_minutos)
    const dia = DIAS[new Date(`${fecha}T00:00:00`).getDay()]
    const franjasNegocio = negocio.horario_atencion?.[dia] ?? []

    if (!dentroDeFranjas(hora_inicio, hora_fin, franjasNegocio)) {
      return jsonResponse({ error: 'Fuera del horario de atención del negocio' }, 409)
    }

    let candidatos
    if (estilista_id) {
      const { data, error } = await supabase
        .from('estilista')
        .select('id, negocio_id, horario_disponible, activo')
        .eq('id', estilista_id)
        .single()

      if (error || !data || !data.activo || data.negocio_id !== negocio_id) {
        return jsonResponse({ error: 'Estilista no disponible' }, 404)
      }
      candidatos = [data]
    } else {
      const { data, error } = await supabase
        .from('estilista')
        .select('id, negocio_id, horario_disponible, activo')
        .eq('negocio_id', negocio_id)
        .eq('activo', true)

      if (error) throw error
      candidatos = data ?? []
    }

    const { data: turnosDelDia, error: turnosError } = await supabase
      .from('turno')
      .select('estilista_id, hora_inicio, hora_fin')
      .eq('negocio_id', negocio_id)
      .eq('fecha', fecha)
      .neq('estado', 'cancelado')

    if (turnosError) throw turnosError

    // "cualquiera disponible": se resuelve acá al primer estilista libre,
    // para no dejar turno.estilista_id null y evitar que dos clientes
    // terminen asignados a la misma persona en el mismo horario.
    const estilistaElegido = candidatos.find((e) => {
      const franjas = e.horario_disponible?.[dia] ?? []
      if (!dentroDeFranjas(hora_inicio, hora_fin, franjas)) return false
      return !(turnosDelDia ?? []).some(
        (t) => t.estilista_id === e.id && seSuperponen(hora_inicio, hora_fin, t.hora_inicio, t.hora_fin),
      )
    })

    if (!estilistaElegido) {
      return jsonResponse({ error: 'Horario no disponible' }, 409)
    }

    const { data: turno, error: insertError } = await supabase
      .from('turno')
      .insert({
        negocio_id,
        estilista_id: estilistaElegido.id,
        servicio_id,
        fecha,
        hora_inicio,
        hora_fin,
        cliente_nombre,
        cliente_email,
        cliente_telefono,
        nota,
        monto: servicio.precio,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return jsonResponse({ turno }, 201)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Error inesperado' }, 500)
  }
})
