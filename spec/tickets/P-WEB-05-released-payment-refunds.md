# [P-WEB-05] Soportar refund después de liberar el pago

Capacidad posterior al lanzamiento. Hoy el contrato aprobado rechaza refunds de pagos
`RELEASED`; no debe habilitarse parcialmente.

## Trabajo pendiente

- Diseñar Transfer Reversal idempotente y su reconciliación asíncrona.
- Definir insuficiencia de saldo Connect, reversals parciales y disputa concurrente.
- Extender el ledger sin reescribir snapshots históricos de principal, fee y comisión.
- Añadir estados operativos, auditoría admin, webhook/retry y copy es/en.
- Verificar escenarios total, parcial, retry, fallo permanente y conciliación manual.

