# HOME360 web/API — especificación y backlog activo

Las specs numeradas documentan el contrato de producto y arquitectura implementado. No son
una lista de trabajo pendiente. El backlog activo, depurado contra el código el 2026-09-01,
vive exclusivamente en [`spec/tickets/README.md`](tickets/README.md).

## Estado

- Web de negocio, admin, corporativo y API móvil F0–F7 están implementados.
- El cierre técnico está bloqueado por el typecheck de Expo Push.
- Quedan contratos aditivos solicitados por mobile, decisiones de producción y rollout E2E.
- Refund de pagos ya liberados permanece como capacidad posterior explícita.

## Documentos normativos

- `00-foundations.md` … `06-landing-polish.md`: arquitectura y superficies web.
- `07-product-context.md`: relación con la app móvil.
- `08-business-model-alignment.md`: decisiones del modelo de negocio; prevalece ante
  contradicciones históricas.
- `09-corporate-accounts.md`: cuentas corporativas B2B.
- `10-mobile-app.md`: alcance de la API consumida por mobile.
- `DESIGN-DIRECTIVE.md`: contrato visual.

## Reglas de ejecución

- TypeScript estricto, módulos localizados, router delgado, servicios de dominio y
  `TrpcResponse` uniforme.
- Multitenancy/ownership siempre en servidor; dinero entero en centavos MXN.
- Verificación: `pnpm typecheck`, `pnpm check`, `pnpm build` y recorrido manual.
- El agente no ejecuta operaciones de base de datos, seed, Stripe CLI ni despliegues. Los
  pasos de rollout están en `P-WEB-04` y los realiza Roger.
