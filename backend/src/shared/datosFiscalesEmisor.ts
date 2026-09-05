// Datos fiscales del emisor (Monsa Global Cargo) para el CFDI. Un solo
// emisor no justifica un modelo propio en la base de datos -- seria una
// tabla de una sola fila. Vive aqui, como constante, y se usa tanto en los
// documentos imprimibles (modules/reportes) como en el libro de Excel.
//
// ASUNCION: RFC y domicilio ficticios. Reemplazar por los datos reales de
// Monsa antes de cualquier uso fuera de desarrollo/pruebas -- el timbrado
// ante el PAC sigue simulado (CLAUDE.md seccion 5.3).
export const EMISOR_CFDI = {
  rfc: "MGC240101AA1",
  razonSocial: "MONSA GLOBAL CARGO S.A. DE C.V.",
  regimenFiscal: "601", // General de Ley Personas Morales
  codigoPostal: "44100",
};
