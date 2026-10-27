# AI Media Network v1.9.3 — Identity Studio

## Alcance
- Botón **Importar desde Facebook** en Red > Identidades de medios.
- Recupera cuentas Facebook ya conectadas, activas y válidas desde PostgreSQL, sin volver a pedir tokens.
- Muestra la identidad editorial que ya tiene cada cuenta.
- Permite elegir estado, nombre y enfoque; genera una propuesta editable de ADN editorial y visual mediante OPENAI_API_KEY o propuesta básica si no está configurada.
- La persona revisa y aprueba; las identidades nuevas nacen en estado **DRAFT** y conservan la conexión real, con traslado explícito desde la identidad previa.
- Si coincide nombre y estado con la identidad ya vinculada, permite actualizar explícitamente el ADN existente, sin crear otro medio ni mover la conexión.
- No publica contenido ni activa identidades automáticamente.
- No crea logotipos, PSD ni nuevas plantillas en esta versión: se administran en el módulo Plantillas existente.

## Prueba manual
1. /api/health debe indicar `version: "1.9.3"`.
2. Red > Identidades de medios > Importar desde Facebook.
3. Ver páginas conectadas y su identidad actual. Seleccionar una.
4. Generar propuesta, editar ADN y revisar confirmación.
5. Para una identidad ya existente, aprobar y confirmar actualización de su ADN.
6. Para una identidad nueva, cambiar el nombre del medio, generar propuesta, aprobar y confirmar traslado de la conexión. Ver que aparece en DRAFT.
7. Probar la conexión de la página desde Integraciones y confirmar que no hubo publicación automática.

## Precauciones
- La propuesta generada por IA se basa en nombre, estado y enfoque ingresado; **no analiza automáticamente la historia real de la página**.
- Si existen publicaciones vinculadas previamente a la cuenta social, conservar sus registros; al mover el canal cambia su identidad actual. Revisar historiales antes de transferir una página utilizada en producción.
- Usar primero una copia de entorno de prueba y respaldar PostgreSQL.
- Los endpoints administrativos preexistentes carecen de autenticación; no exponer esta capacidad a terceros sin control de acceso. La falta de autenticación es un asunto pendiente de seguridad anterior a esta versión.
- La sintaxis JavaScript se revisó en los tres archivos principales; no se pudieron ejecutar pruebas integrales ni llamadas reales a Meta/PostgreSQL desde este entorno.
