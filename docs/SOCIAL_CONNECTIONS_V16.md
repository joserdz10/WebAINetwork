# Social Connections Manager v1.6.0

## Objetivo
Administrar Facebook e Instagram desde AI Media Network sin crear variables de Railway por cada página.

## Configuración única
En Railway agrega una sola variable privada:

`SOCIAL_CREDENTIALS_KEY=<secreto largo y aleatorio>`

Opcional:

`PUBLIC_BASE_URL=https://tu-dominio`

`META_API_VERSION=v23.0`

`PUBLIC_BASE_URL` solo es necesario cuando no está disponible `RAILWAY_PUBLIC_DOMAIN`; se usa para entregar a Instagram una URL pública firmada de la pieza gráfica.

## Flujo de conexión
1. Sistema -> Integraciones -> Facebook e Instagram.
2. Conectar página de Meta.
3. Elegir la identidad editorial.
4. Pegar un Access Token temporal de Meta.
5. La plataforma consulta `/me`, `/me/permissions` y `/me/accounts`.
6. El usuario elige la página detectada y, si existe, la cuenta profesional de Instagram asociada.
7. El token de página se cifra con AES-256-GCM y se guarda en PostgreSQL.
8. El token temporal pegado en el formulario no se persiste.

## Publicación
- Facebook sin imagen: `/{page-id}/feed`.
- Facebook con imagen generada en AI Media Network: carga binaria a `/{page-id}/photos`; no requiere una URL externa de la imagen.
- Instagram: crea contenedor en `/{ig-user-id}/media` y publica con `/{ig-user-id}/media_publish`. Para imágenes almacenadas como base64, AI Media Network expone una URL pública firmada de corta superficie de descubrimiento.

## Controles
- Probar conexión valida la cuenta con Graph API.
- Desconectar elimina el token cifrado de la cuenta.
- La API nunca devuelve `credentialCiphertext`, `credentialIv` ni `credentialTag` a la interfaz.
- Solo cuentas `CONNECTED` e `isActive=true` aparecen al publicar.
- Una pieza debe estar `APPROVED` antes de publicar o programar.

## Permisos comprobados por la interfaz
El descubrimiento muestra si el token reporta estos permisos usados por el flujo de páginas:
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

Los permisos de Instagram requeridos dependen de la configuración de la app de Meta y de la cuenta profesional conectada; la plataforma muestra los permisos realmente concedidos por Meta para facilitar el diagnóstico.
