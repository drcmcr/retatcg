# @reta/torneo

Lógica del torneo como funciones puras de TypeScript: no sabe nada de pantallas ni de la base de datos. El servidor la llama y guarda el resultado; así lo crítico se prueba aislado.

```
npm install
npm test          # 50 pruebas, incluye simulaciones de torneos completos de 4 a 128 jugadores
npm run typecheck
```

## Qué incluye

| Archivo | Responsabilidad |
| --- | --- |
| `scoring.ts` | Resultado de un encuentro, puntos 3/1/0, tabla de posiciones con OMW%, OOMW%, GW%, enfrentamiento directo y sorteo con semilla |
| `swiss.ts` | Emparejamiento suizo: mismo puntaje primero, sin revanchas, bye al de menor puntaje sin bye previo |
| `elimination.ts` | Bracket sembrado (1 vs 8, 4 vs 5…), byes para los mejores sembrados, posiciones finales |
| `structure.ts` | Rondas suizas y top cut sugeridos por número de jugadores |
| `ranking.ts` | Puntos de Rango por torneo, rangos y divisiones, piso de rango, reinicio de temporada |
| `medals.ts` | Las 8 medallas de temporada y la invitación a la Final (6 de 8) |
| `rng.ts` | Aleatoriedad con semilla: todo emparejamiento y sorteo se puede reproducir |

## Reglas implementadas (fuente: especificación funcional)

- **Desempates:** puntos → OMW% → OOMW% → GW% → enfrentamiento directo (solo empates de dos) → sorteo con semilla. Piso del OMW% en 25% (configurable a 33%).
- **Bye:** vale victoria (3 puntos) y 2-0 en partidas; no cuenta como rival para OMW%.
- **Retirados:** no se emparejan, pero siguen en la tabla y cuentan para sus rivales.
- **Suizo:** si un grupo de puntaje queda impar, el sobrante baja al siguiente. Si evitar revanchas fuera imposible, se permiten y se reportan.
- **PR:** victoria +15 (el bye cuenta como victoria), derrota −5, empate +5, bono top 8/4/2/1 = 15/25/40/60, multiplicador casual ×0, comunitario ×1, clasificatorio ×1.5, mayor ×2. Mínimo 8 jugadores con cuenta. Máximo 2 victorias por semana contra el mismo rival.
- **Rangos:** 300 PR por rango, 100 por división. Leyenda: 1800 PR y top 100. Dentro de la temporada se baja de división pero no de rango. Al cerrar temporada se baja un rango.
- **Medallas:** solo cuentan torneos que dan PR. El bye no suma ni corta la racha. Vórtice (suizo sin derrotas) exige al menos 3 rondas suizas.

## Decisiones abiertas

- Valores de PR y número de medallas para la Final: ajustar con datos de la primera temporada.

## Ritmos y regla de mazo

- **Ritmos** (`pace.ts`): en vivo (rondas cronometradas), por jornadas (sesiones con fecha; `validateSessions` revisa el calendario) y por ventana (cada ronda con plazo, 24 h por defecto).
- **Por ventana:** `firstCommonSlot` propone el primer bloque de 1 h en común; `resolveAtDeadline` decide al vencer el plazo (activo vs. inactivo → victoria; ninguno activo → derrota doble; los dos activos o disputa → juez). Con hora acordada solo cuenta haber llegado. `canCloseEarly` cierra la ronda si todas las mesas están confirmadas; `bracketFeed` deja avanzar la llave mesa por mesa.
- **Derrota doble:** `MatchRecord.doubleLoss`. Cuenta como derrota para ambos, sin partidas; el suizo no la repite.
- **Regla de mazo** (`deck.ts`): libre, por ronda (se declara antes del emparejamiento y se arrastra) o fijo (se declara al inscribirse). Por defecto: casual → libre, comunitario → por ronda, clasificatorio y mayor → fijo. Mismo mazo dentro de un Bo3.
- **Restricciones de mazo** (`restrictions.ts`): sets permitidos o "hasta la expansión X", cartas prohibidas y limitadas, reglas de ex (prohibidos, solo ex, sin Mega, máximo), solo rombos, sin promos, monotipo y regla libre. `effectiveDeckPolicy` sube el mazo libre a "por ronda" si hay restricciones; `validateRestrictionsConfig` revisa la configuración; `checkDeck` valida una lista contra las reglas base de Pocket (20 cartas, máx. 2 por nombre) y las restricciones, listo para las decklists de la v2.
