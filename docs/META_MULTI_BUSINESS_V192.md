# AI Media Network v1.9.2 — descubrimiento multiporfolio de Meta

## Cambios
- El inicio de sesión de Facebook solicita ahora `business_management` junto a los permisos para páginas.
- La consulta conserva `/me/accounts` y, si Meta concede `business_management`, consulta `/me/businesses`, `/{business-id}/owned_pages` y `/{business-id}/client_pages` con paginación.
- Las páginas se deduplican por ID y se muestran agrupables por portafolio.
- Las páginas devueltas únicamente por los portafolios se señalan como **informativas, no conectables**; no se genera token ficticio ni se habilita publicar.
- Los problemas de acceso a un portafolio no bloquean el resto de la consulta.
- La API de salud muestra `version: "1.9.2"`.

## Prueba
1. Tras desplegar, verificar `/api/health` -> `version: "1.9.2"`, `metaOAuthConfigured: true`.
2. Sistema -> Integraciones -> Conectar página de Meta -> Conectar con Facebook.
3. Autorizar también la nueva solicitud de `business_management` (si Meta la ofrece).
4. Comprobar número de portafolios, páginas conectables y páginas informativas.
5. Conectar solamente las páginas con credencial disponible y usar Probar conexión. No es necesario publicar una pieza.

## Restricciones
- La disponibilidad de `business_management` está sujeta a la aprobación, los roles, el modo de la app y el acceso concreto de la persona; puede no concederse.
- La detección de un activo comercial **no equivale a permiso de publicación**. En ese caso asignar los permisos de la página al perfil y volver a autorizar la aplicación para obtener un Page Access Token.
- El inicio de sesión OAuth guarda el resultado temporalmente en memoria de una instancia durante 10 minutos; múltiples réplicas requieren persistencia temporal compartida.
- El panel y las APIs existentes no cuentan todavía con un sistema de login administrativo. No exponer a operadores o terceros sin un control de acceso; antes de uso público hay que proteger rutas de administración, autorización y publicación.
- No se han ejecutado pruebas locales: la red del entorno de compilación no permite resolver github.com. Ejecutar `npm run check` y pruebas de conexión con Meta antes de habilitar en producción.
