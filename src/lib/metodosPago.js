export const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
]

export function etiquetaMetodoPago(valor) {
  return METODOS_PAGO.find((m) => m.valor === valor)?.etiqueta ?? null
}
