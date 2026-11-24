# Reta

Web app (PWA) para organizar y jugar torneos de Pokémon TCG Pocket: inscripción, emparejamiento suizo y eliminación, contraseña de partida automática, reporte de resultados, rangos, medallas y títulos de temporada.

Reta no está afiliada a The Pokémon Company, Nintendo, Creatures, GAME FREAK ni DeNA.

## Estructura

- `packages/torneo`: motor del torneo en TypeScript puro. Emparejamiento, desempates, eliminación, ritmos (en vivo, por jornadas, por ventana), PR y rangos, medallas y títulos, conducta, regla y restricciones de mazo. Ver su README.
- `brand/`: logotipo, isotipo e íconos de la app.
- `CLAUDE.md`: reglas del proyecto para quien programe.

## Motor del torneo

```bash
cd packages/torneo
npm install
npm test
```
