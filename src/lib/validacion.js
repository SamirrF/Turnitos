export function emailValido(valor) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor)
}

export function telefonoValido(valor) {
  return /^[0-9+\-\s()]{6,}$/.test(valor)
}
