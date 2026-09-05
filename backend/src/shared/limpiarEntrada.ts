// Normalizacion compartida por todos los PATCH de edicion.
//
// Los formularios del frontend mandan siempre todos los campos del registro,
// asi que un campo que el usuario dejo vacio llega como "" y no como undefined.
// Sin esto, un PATCH escribiria "" en la columna en vez de vaciarla, y los
// filtros/validaciones posteriores tratarian "" como un valor capturado.
//
//  - undefined  -> se omite del update (el campo no se toca)
//  - ""         -> null (el usuario vacio el campo a proposito)
//  - resto      -> se escribe tal cual
export function limpiarEntrada<T extends Record<string, unknown>>(data: T) {
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(data)) {
    if (valor === undefined) continue;
    salida[clave] = typeof valor === "string" && valor.trim() === "" ? null : valor;
  }
  return salida as { [K in keyof T]: T[K] };
}
