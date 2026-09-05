import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

type Tema = "claro" | "oscuro";
const CLAVE_TEMA = "mgc.tema";

interface ThemeContextValue {
  tema: Tema;
  alternarTema: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Preferencia guardada gana sobre la del sistema; sin nada guardado, se sigue
// prefers-color-scheme (un usuario que nunca toco el switch ve lo que ya
// configuro en su SO, sin sorpresas).
function temaInicial(): Tema {
  const guardado = localStorage.getItem(CLAVE_TEMA);
  if (guardado === "claro" || guardado === "oscuro") return guardado;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "oscuro" : "claro";
}

// Unico lugar que toca la clase "dark" en <html> (Tailwind darkMode: "class").
// Persiste en localStorage para que sobreviva a un refresh sin depender de
// que el navegador recuerde la preferencia del sistema.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "oscuro");
    localStorage.setItem(CLAVE_TEMA, tema);
  }, [tema]);

  const alternarTema = useCallback(() => {
    setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro"));
  }, []);

  return <ThemeContext.Provider value={{ tema, alternarTema }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
