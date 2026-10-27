# Conectar Facebook desde la interfaz (OAuth)

Esta actualización agrega **Conectar con Facebook** en Sistema > Integraciones > Facebook e Instagram y conserva las opciones anteriores de Page Access Token.

## Configuración única en Railway
- `SOCIAL_CREDENTIALS_KEY`: clave privada existente para cifrar los tokens.
- `META_APP_ID`: identificador de la aplicación de Meta Developers.
- `META_APP_SECRET`: secreto de la aplicación (solo backend; no mostrar ni guardar en el navegador).
- `PUBLIC_BASE_URL`: dirección HTTPS pública real de AI Media Network, por ejemplo `https://ejemplo.up.railway.app`. Si no se define, se utiliza `RAILWAY_PUBLIC_DOMAIN`.

En **Meta for Developers**, configura Facebook Login y autoriza la URI de redirección exacta:

`https://TU-DOMINIO/api/meta/oauth/callback`

Configura los permisos `pages_show_list`, `pages_read_engagement`, `pages_manage_posts` y concede las autorizaciones y el acceso de la app según las restricciones de Meta. En modo desarrollo solo las personas con roles de la aplicación pueden autorizarse; para otras personas se requiere el modo y revisión aplicables.

## Uso
1. Sistema > Integraciones > Conectar página de Meta > Conectar con Facebook.
2. Iniciar sesión en Facebook y seleccionar las páginas que se autorizarán.
3. Al volver, elegir para **cada página** la identidad editorial de cualquiera de los estados ya registrados.
4. Presionar Conectar para cada página, y luego Probar conexión en el listado.
5. Aprobar una pieza editorial y publicarla mediante el flujo existente.

Los tokens de página se guardan cifrados con AES-256-GCM y no se escriben como variables por página en Railway. El resultado OAuth se conserva temporalmente en memoria del proceso durante diez minutos; requiere que la autorización y su retorno se atiendan por la misma instancia de la aplicación. Si Railway usa múltiples réplicas, mover el estado temporal a un almacén compartido con expiración (PostgreSQL/Redis) antes de activar varias instancias.

## Nota operativa de seguridad
La aplicación existente no implementa un sistema de autenticación de usuarios para su panel de administración. Antes de exponer integraciones y publicación en un dominio abierto a terceros, es necesario proteger el acceso a la plataforma y a sus APIs. No incluir tokens ni secretos en capturas, tickets o GitHub.
