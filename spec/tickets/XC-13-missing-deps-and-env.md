# [XC-13] Completar dependencias, componentes shadcn y variables de entorno en F0

> Ticket transversal de tooling. Consolida los hallazgos XC-14 y XC-15 de
> `spec/tickets/XC-findings.md`.

## Metadatos

- **Fase**: XC — corrección transversal de specs (aplicar antes de ejecutar F0)
- **Spec origen**: `spec/00-foundations.md` §2 · consumidores:
  `spec/02` §2, `spec/03` §3/§6, `spec/04` §2, `spec/05` §5
- **Depende de**: —
- **Tamaño estimado**: S

## Contexto

F5 usa `react-hook-form` + `@hookform/resolvers` y varias fases consumen componentes shadcn
que F0-06 no instala: `alert`, `slider`, `radio-group` y `form`. Sin este ticket, F3/F4/F5
fallan en la primera importación. La auditoría anterior mezclaba dos tareas que ya tienen
owner: `papaparse` + tipos se instalan en `F2-09`, y `CRON_SECRET` se declara en `F3-10`.
No deben instalarse/declararse por duplicado en F0.

## Alcance

- `package.json` y `pnpm-lock.yaml`: instalar las dos dependencias de formulario.
- `src/components/ui/`: agregar los cuatro componentes shadcn ausentes.
- Fuera de alcance: `papaparse` (owner `F2-09`), `CRON_SECRET` (owner `F3-10`),
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` y cualquier edición de specs.

## Detalle técnico

```bash
pnpm add react-hook-form @hookform/resolvers
```

```bash
pnpm dlx shadcn@latest add alert slider radio-group form
```

No volver a ejecutar `shadcn init`; respetar `components.json` y la configuración Tailwind
4 creada por `F0-06`. Si el CLI añade dependencias transitivas, conservar solo las que
requieran los componentes generados.

## Restricciones no negociables

- **Sin pruebas automatizadas**: no se crean archivos `*.test.ts` ni configuracion de test; esta seccion anula cualquier mencion de vitest o pruebas en el resto del ticket. La verificacion es `pnpm typecheck`, `pnpm check` y `pnpm build`.
- Paquetes con pnpm; identificadores en inglés.
- TypeScript estricto: los tipos de `papaparse` vía `@types/papaparse` (sin `any`).
- Toda procedure afectada conserva `TrpcResponse`
  `{ result, error, status, message }`; este ticket no introduce endpoints.
- El agente no ejecuta migraciones/seed; este ticket no toca BD.

## Criterios de aceptación

- [ ] `react-hook-form` y `@hookform/resolvers` están en `dependencies`.
- [ ] `alert`, `slider`, `radio-group` y `form` existen en `src/components/ui/`.
- [ ] `F5-14` compila sin paquetes implícitos y no conserva los campos obsoletos del bono
      por volumen (esa corrección pertenece a `F5-14`, no a este ticket).
- [ ] `papaparse` sigue teniendo un solo owner (`F2-09`) y `CRON_SECRET` uno (`F3-10`).

## Comandos para Roger (si aplica)

—
