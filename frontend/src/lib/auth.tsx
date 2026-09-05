import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  api,
  borrarToken,
  guardarToken,
  leerToken,
  registrarManejadorDeSesion,
} from "@/lib/api";

export interface UsuarioSesion {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}

interface EstadoAuth {
  usuario: UsuarioSesion | null;
  // true mientras se valida el token guardado contra /auth/yo. Sin esto, un
  // refresh de pagina mandaria al login por un instante antes de resolver.
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
}

const AuthContext = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [cargando, setCargando] = useState(true);

  const cerrarSesion = useCallback(() => {
    borrarToken();
    setUsuario(null);
  }, []);

  // El interceptor de axios avisa aqui cuando el backend responde 401: la
  // sesion se limpia una sola vez, desde un solo lugar.
  useEffect(() => {
    registrarManejadorDeSesion(() => setUsuario(null));
  }, []);

  // Al montar, si hay token guardado se valida contra el backend en vez de
  // confiar en el payload local: un token expirado o de un usuario dado de
  // baja debe mandar al login, no dejar la app a medias.
  useEffect(() => {
    let vigente = true;
    async function validar() {
      if (!leerToken()) {
        setCargando(false);
        return;
      }
      try {
        const { data } = await api.get<UsuarioSesion>("/auth/yo");
        if (vigente) setUsuario(data);
      } catch {
        borrarToken();
        if (vigente) setUsuario(null);
      } finally {
        if (vigente) setCargando(false);
      }
    }
    validar();
    return () => {
      vigente = false;
    };
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ token: string; usuario: UsuarioSesion }>("/auth/login", {
      email,
      password,
    });
    guardarToken(data.token);
    setUsuario(data.usuario);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

// Etiqueta legible del rol para la UI (el enum del backend viene en
// MAYUSCULAS_CON_GUION_BAJO).
export function etiquetaRol(rol: string) {
  return rol.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
