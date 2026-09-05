/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta de marca del proyecto. El valor base (navy / teal / amber) es
        // el mismo de la presentacion ejecutiva; las escalas se derivan de el
        // para poder hacer fondos suaves y bordes tenues SIN meter colores
        // ajenos a la marca (el verde generico que tenia el dashboard).
        navy: {
          DEFAULT: "#0B3D5C",
          50: "#F0F5F9",
          100: "#DDE8F0",
          200: "#B9CEDE",
          300: "#8AAEC6",
          400: "#4E7E9F",
          500: "#1F5B80",
          600: "#0B3D5C",
          700: "#09324B",
          800: "#07273A",
          900: "#051B29",
        },
        teal: {
          DEFAULT: "#1C7293",
          50: "#F0F7FA",
          100: "#DCEDF3",
          200: "#B5DAE6",
          300: "#83BFD4",
          400: "#4A9BB8",
          500: "#1C7293",
          600: "#186078",
          700: "#144D61",
          800: "#103C4B",
          900: "#0C2B36",
        },
        amber: {
          DEFAULT: "#F2A93B",
          50: "#FEF8EE",
          100: "#FDEED6",
          200: "#FADCAC",
          300: "#F7C476",
          400: "#F2A93B",
          500: "#E08F1C",
          600: "#BC7115",
          700: "#965716",
          800: "#7A4718",
          900: "#653C17",
        },
        // Superficie de la aplicacion: gris ligeramente frio para que el navy
        // y el teal se lean como parte del mismo sistema, no como parches.
        lienzo: "#F5F7FA",
      },
      boxShadow: {
        // Profundidad sutil: una sombra de contacto muy corta + un halo amplio
        // y casi transparente. Nada de sombras duras.
        tarjeta: "0 1px 2px rgba(11,61,92,0.06), 0 1px 3px rgba(11,61,92,0.04)",
        elevada: "0 4px 6px -1px rgba(11,61,92,0.07), 0 2px 4px -2px rgba(11,61,92,0.05)",
        panel: "0 10px 30px -12px rgba(11,61,92,0.25)",
      },
      fontSize: {
        // Escalon de etiqueta (KPI, encabezados de tabla, secciones).
        etiqueta: ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      },
    },
  },
  plugins: [],
};
