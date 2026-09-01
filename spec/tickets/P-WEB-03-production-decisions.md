# [P-WEB-03] Cerrar decisiones de producción aún no codificables

## Decisiones requeridas de Roger

1. Huso horario canónico para cortes mensuales financieros.
2. Tratamiento fiscal de precios de suscripción (IVA/CFDI) antes de publicar Prices.
3. Política al cambiar Prices con suscriptores vivos: conservar el Price previo o migrar
   en renovación.
4. Retención/anonimización de facturas y trazas financieras al eliminar un negocio.
5. Catálogo definitivo de modelos IA, bootstrap del singleton `PlatformSettings` y rangos
   administrativos finales.

## Después de decidir

- Actualizar el contrato normativo correspondiente y crear tickets de código acotados.
- Añadir validaciones de configuración que fallen antes de procesar dinero o IA.
- Repetir build y recorrido manual de las superficies afectadas.

