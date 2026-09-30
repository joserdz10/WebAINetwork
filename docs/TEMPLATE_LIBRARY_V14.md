# Template Library v1.4.0

La biblioteca de plantillas aplica a todas las identidades actuales y futuras.

Flujo recomendado:
1. Subir PSD maestro.
2. Subir base PNG/JPG con elementos fijos y campos variables ocultos.
3. Revisar campos detectados: PHOTO, CATEGORY, HEADLINE, SUMMARY, SOURCE.
4. Ajustar el mapeo si es necesario.
5. Abrir Vista previa para ejecutar un render de prueba no politico.
6. Activar la plantilla cuando el render sea correcto.

Estados:
- READY: puede previsualizarse y activarse.
- NEEDS_BASE_IMAGE: falta base renderizable.
- NEEDS_MAPPING: faltan como minimo PHOTO o HEADLINE.

Norte En Alerta conserva NEA_FEED_4X5_V1 como plantilla canonica incorporada al sistema.
