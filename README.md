# Monsa Global Cargo — Sistema de Gestión

Sistema de gestión operativa para Monsa Global Cargo (freight forwarder): cotizaciones,
Routing Order, bookings, embarques, seguimiento, facturación (con ciclo fiscal CFDI completo)
y cobranza. Reemplaza el flujo manual en Excel que llevaba la operación hasta ahora.

Ver **[CLAUDE.md](./CLAUDE.md)** para la arquitectura completa, la cascada operativa, el
modelo de datos, las convenciones del proyecto y cómo correrlo en local — es la fuente de
verdad del proyecto.

## Stack

- **Backend**: Node.js + Express + TypeScript + Prisma + MySQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS

## Quickstart

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run prisma:migrate
npm run seed
npm run seed:sat   # catalogos oficiales del SAT (requiere internet la primera vez)
npm run dev        # http://localhost:4000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Detalle completo en [CLAUDE.md](./CLAUDE.md).
