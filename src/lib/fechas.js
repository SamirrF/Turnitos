function parseISO(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function hoyISO() {
  return toISO(new Date())
}

export function sumarDias(fechaISO, dias) {
  const date = parseISO(fechaISO)
  date.setDate(date.getDate() + dias)
  return toISO(date)
}

export function inicioDeSemana(fechaISO) {
  const date = parseISO(fechaISO)
  const diaSemana = date.getDay() // 0 = domingo ... 6 = sábado
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana // lunes como inicio
  date.setDate(date.getDate() + offset)
  return toISO(date)
}

export function finDeSemana(fechaISO) {
  return sumarDias(inicioDeSemana(fechaISO), 6)
}

export function inicioDeMes(fechaISO) {
  const date = parseISO(fechaISO)
  return toISO(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function finDeMes(fechaISO) {
  const date = parseISO(fechaISO)
  return toISO(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}
