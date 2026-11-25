# Reta — app de torneos para Pokémon TCG Pocket

## Fuentes de verdad
- Especificación funcional (doc): https://claude.ai/artifact/1prAq31k3iCxk52gxAV7cW
- Exploración visual, opción B final: https://claude.ai/artifact/1LKPyWTiXv4chNntszMz44

## Stack
Next.js 16 (App Router) + TypeScript, Tailwind con tokens como variables CSS, Radix UI (primitivas), Supabase (Postgres, Auth, Realtime, Storage, RLS), Serwist (PWA), Web Push, next/og para tarjetas, Vitest + Playwright, Zod, next-intl, Sentry, Vercel.

## Supabase
- Proyecto de desarrollo: `huella-dev` (nombre de trabajo anterior; se queda así) (ref `pijoxhnpmlgieqrcgqhb`, us-east-1).
- Cambios de esquema solo por migraciones en `supabase/migrations`. Nunca editar el esquema a mano en el panel.
- Datos sensibles en tablas aparte con RLS: `match_secrets` (contraseña) y `profile_private` (ID de amigo, nombre en Pocket).
- PR, rangos y medallas los calcula solo el servidor.

## Reglas del producto que no se negocian
- Sin chat libre: solo mensajes rápidos predefinidos y "Llamar juez" (protección de menores).
- Sin datos de contacto externos visibles para otros jugadores.
- Sin arte de cartas ni marcas de Pokémon en la UI; aviso de no afiliación.
- Contraste mínimo 4.5:1 en texto y 3:1 en componentes; respetar "reducir movimiento".

## Tipografía y color
- Marca: Reta (web y redes: retatcg). Logo en brand/RETA_LOGO.pdf; isotipo y logotipo se usan juntos como en el moodboard.
- Bricolage Grotesque (interfaz y titulares condensados; reemplaza a Mona Sans), JetBrains Mono (contraseñas, IDs, marcadores), Jersey 20/15 (capa pixel, solo titulares y etiquetas, peso regular).
- Tokens: fondo #0E0E12, superficie #1A1A22, superficie-tarjeta #121218, texto #F4F4F5 / blanco #FFFFFF, texto-secundario #B4B4BE, texto-apoyo #D6D6DD, acento #AAFF01, acento-2 #5820FF (SOLO relleno con texto blanco; nunca texto ni borde sobre fondo oscuro: 2.8:1), acento-3 #01EEFE, patrón de cuadros #1A1A22/#0E0E12 de 16 px (texto siempre sobre panel sólido), borde-medio #6E6E7A, borde-sutil #3A3A44 (solo decorativo), éxito #3DDC97, advertencia #FFB020, error #FF5C6C (estados siempre con ícono y texto), medallas: ruta A (lima → cian → violeta aclarado #9A78FF; Astro con el degradado completo del isotipo; nunca degradado directo lima-violeta). Ponzoña usa el ícono de riesgo y Astro la estrella de 6 puntas.
- Ícono de jugador (no hay fotos ni emblemas): se genera del ID interno de la cuenta, nunca del usuario. Cuadrícula de 5×5 en espejo, 6 a 11 de 15 celdas, un color plano (#AAFF01, #01EEFE o #9A78FF) sobre #121218, sin degradado ni foil. SVG con `shape-rendering: crispEdges`; lista de patrones vetados en el servidor.
- Pantallas de referencia (HTML): https://claude.ai/artifact/BaRcHPzToqEJZzJgUZzuaX

## Código
- `packages/torneo`: lógica pura del torneo con pruebas. Cualquier cambio de reglas va primero aquí, con prueba.
- Español en textos de UI y en comentarios de reglas; nombres de código en inglés.
