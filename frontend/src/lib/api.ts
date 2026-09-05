import axios from "axios";

const CLAVE_TOKEN = "mgc.token";

export const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// El token vive en localStorage para que la sesion sobreviva a un refresh, y
// se lee en cada request (no se captura al arrancar) para que login y logout
// surtan efecto de inmediato sin recrear la instancia de axios.
export function leerToken() {
  return localStorage.getItem(CLAVE_TOKEN);
}

export function guardarToken(token: string) {
  localStorage.setItem(CLAVE_TOKEN, token);
}

export function borrarToken() {
  localStorage.removeItem(CLAVE_TOKEN);
}

api.interceptors.request.use((config) => {
  const token = leerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un 401 significa token ausente, invalido o expirado: la sesion se limpia y
// se avisa al AuthProvider, que redirige a /login. Se hace aqui y no en cada
// pagina para que ninguna vista se quede pidiendo datos con un token muerto.
type ManejadorSesion = () => void;
let alPerderSesion: ManejadorSesion = () => undefined;

export function registrarManejadorDeSesion(handler: ManejadorSesion) {
  alPerderSesion = handler;
}

api.interceptors.response.use(
  (respuesta) => respuesta,
  (error) => {
    if (error?.response?.status === 401) {
      borrarToken();
      alPerderSesion();
    }
    return Promise.reject(error);
  }
);

// Los errores de negocio del backend viajan siempre como { error: "..." }.
// La UI los muestra tal cual (CLAUDE.md seccion 8): esta funcion es el unico
// lugar que decide el texto de respaldo cuando la respuesta no trae mensaje.
export function mensajeError(error: unknown, respaldo = "Ocurrio un error inesperado") {
  const posible = error as { response?: { data?: { error?: string } }; message?: string };
  return posible?.response?.data?.error ?? posible?.message ?? respaldo;
}

// Descarga de PDFs generados por el backend. No se puede usar window.open:
// las rutas /api exigen el header Authorization, que un <a> o una ventana
// nueva no mandan. Se pide el blob por axios y se abre desde memoria.
export async function abrirPdf(url: string) {
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  window.open(objectUrl, "_blank", "noopener");
  // Se libera con retraso: revocarlo de inmediato deja la pestana en blanco.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

// Descarga directa (Excel, CSV...) en vez de abrir en pestana: un <a download>
// sintetico contra un blob URL, mismo motivo que abrirPdf (el header
// Authorization no viaja en una navegacion normal del navegador).
export async function descargarArchivo(url: string, nombreArchivo: string) {
  const { data } = await api.get<Blob>(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
