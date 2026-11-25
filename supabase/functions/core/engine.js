// Generado desde packages/torneo con npm run build:core. No editar a mano.

// src/rng.ts
function seededRandom(seed) {
  let h = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  return () => {
    h = h + 1831565813 >>> 0;
    let t = h;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function shuffle(items, rand) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// src/scoring.ts
var MATCH_POINTS = { win: 3, draw: 1, loss: 0 };
function matchOutcome(m) {
  if (m.b === null) return "A";
  if (m.doubleLoss) return "BOTH_LOSE";
  if (m.gamesA > m.gamesB) return "A";
  if (m.gamesB > m.gamesA) return "B";
  return "DRAW";
}
function computeStandings(players, matches, opts = {}) {
  const floor = opts.floor ?? 0.25;
  const byeGames = opts.byeGames ?? 2;
  const lotSeed = opts.lotSeed ?? "sorteo";
  const acc = /* @__PURE__ */ new Map();
  for (const p of players) {
    acc.set(p.id, { wins: 0, losses: 0, draws: 0, byes: 0, gamePoints: 0, gamesPlayed: 0, opponents: [] });
  }
  const get = (id) => {
    const a = acc.get(id);
    if (!a) throw new Error(`Resultado con un jugador que no est\xE1 inscrito: ${id}`);
    return a;
  };
  for (const m of matches) {
    const A = get(m.a);
    if (m.b === null) {
      A.wins++;
      A.byes++;
      A.gamePoints += 3 * byeGames;
      A.gamesPlayed += byeGames;
      continue;
    }
    const B = get(m.b);
    A.opponents.push(m.b);
    B.opponents.push(m.a);
    if (m.doubleLoss) {
      A.losses++;
      B.losses++;
      continue;
    }
    const games = m.gamesA + m.gamesB + m.gameDraws;
    A.gamePoints += 3 * m.gamesA + m.gameDraws;
    B.gamePoints += 3 * m.gamesB + m.gameDraws;
    A.gamesPlayed += games;
    B.gamesPlayed += games;
    const o = matchOutcome(m);
    if (o === "A") {
      A.wins++;
      B.losses++;
    } else if (o === "B") {
      B.wins++;
      A.losses++;
    } else {
      A.draws++;
      B.draws++;
    }
  }
  const points = (a) => a.wins * MATCH_POINTS.win + a.draws * MATCH_POINTS.draw;
  const played = (a) => a.wins + a.losses + a.draws;
  const mwp = /* @__PURE__ */ new Map();
  for (const [id, a] of acc) {
    const n = played(a);
    mwp.set(id, n === 0 ? floor : Math.max(floor, points(a) / (3 * n)));
  }
  const avg = (xs) => xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;
  const omwp = /* @__PURE__ */ new Map();
  for (const [id, a] of acc) omwp.set(id, avg(a.opponents.map((o) => mwp.get(o))));
  const oomwp = /* @__PURE__ */ new Map();
  for (const [id, a] of acc) oomwp.set(id, avg(a.opponents.map((o) => omwp.get(o))));
  const dropped = new Set(players.filter((p) => p.dropped).map((p) => p.id));
  const rows = players.map((p) => {
    const a = acc.get(p.id);
    return {
      rank: 0,
      playerId: p.id,
      dropped: dropped.has(p.id),
      wins: a.wins,
      losses: a.losses,
      draws: a.draws,
      byes: a.byes,
      matchPoints: points(a),
      mwp: mwp.get(p.id),
      omwp: omwp.get(p.id),
      oomwp: oomwp.get(p.id),
      gwp: a.gamesPlayed === 0 ? floor : Math.max(floor, a.gamePoints / (3 * a.gamesPlayed)),
      opponents: a.opponents
    };
  });
  const EPS = 1e-9;
  const cmpNum = (x, y) => Math.abs(x - y) < EPS ? 0 : y - x;
  rows.sort(
    (x, y) => cmpNum(x.matchPoints, y.matchPoints) || cmpNum(x.omwp, y.omwp) || cmpNum(x.oomwp, y.oomwp) || cmpNum(x.gwp, y.gwp) || hashString(lotSeed + x.playerId) - hashString(lotSeed + y.playerId)
  );
  applyHeadToHead(rows, matches, EPS);
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}
function applyHeadToHead(rows, matches, eps) {
  const same = (x, y) => Math.abs(x.matchPoints - y.matchPoints) < eps && Math.abs(x.omwp - y.omwp) < eps && Math.abs(x.oomwp - y.oomwp) < eps && Math.abs(x.gwp - y.gwp) < eps;
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (j < rows.length && same(rows[i], rows[j])) j++;
    if (j - i === 2) {
      const x = rows[i];
      const y = rows[i + 1];
      let xWins = 0;
      let yWins = 0;
      for (const m of matches) {
        if (m.b === null) continue;
        const pair = m.a === x.playerId && m.b === y.playerId || m.a === y.playerId && m.b === x.playerId;
        if (!pair) continue;
        const o = matchOutcome(m);
        const winner = o === "A" ? m.a : o === "B" ? m.b : null;
        if (winner === x.playerId) xWins++;
        if (winner === y.playerId) yWins++;
      }
      if (yWins > xWins) {
        rows[i] = y;
        rows[i + 1] = x;
      }
    }
    i = j;
  }
}
function playedPairs(matches) {
  const s = /* @__PURE__ */ new Set();
  for (const m of matches) if (m.b !== null) s.add(pairKey(m.a, m.b));
  return s;
}
function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// src/swiss.ts
var SEARCH_BUDGET = 2e5;
function pairSwissRound(input) {
  const active = input.players.filter((p) => !p.dropped).map((p) => p.id);
  if (active.length < 2) throw new Error("Se necesitan al menos 2 jugadores activos para emparejar.");
  const points = new Map(active.map((id) => [id, 0]));
  const hadBye = /* @__PURE__ */ new Set();
  for (const m of input.matches) {
    if (m.b === null) {
      hadBye.add(m.a);
      if (points.has(m.a)) points.set(m.a, points.get(m.a) + MATCH_POINTS.win);
      continue;
    }
    const o = matchOutcome(m);
    const add = (id, v) => points.has(id) && points.set(id, points.get(id) + v);
    if (o === "A") add(m.a, MATCH_POINTS.win);
    else if (o === "B") add(m.b, MATCH_POINTS.win);
    else if (o === "DRAW") {
      add(m.a, MATCH_POINTS.draw);
      add(m.b, MATCH_POINTS.draw);
    }
  }
  const played = playedPairs(input.matches);
  const rand = seededRandom(input.seed);
  const shuffled = shuffle(active, rand);
  const order = new Map(shuffled.map((id, i) => [id, i]));
  const sorted = shuffled.slice().sort((x, y) => points.get(y) - points.get(x) || order.get(x) - order.get(y));
  const byeCandidates = [];
  if (sorted.length % 2 === 1) {
    const fromBottom = sorted.slice().reverse();
    byeCandidates.push(...fromBottom.filter((id) => !hadBye.has(id)));
    if (byeCandidates.length === 0) byeCandidates.push(...fromBottom);
  } else {
    byeCandidates.push(null);
  }
  for (const allowRematch of [false, true]) {
    for (const bye of byeCandidates) {
      const pool = sorted.filter((id) => id !== bye);
      const budget = { left: SEARCH_BUDGET };
      const pairs = pairPool(pool, played, points, allowRematch, budget);
      if (pairs) {
        const pairings = pairs.map(([a, b], i) => ({ table: i + 1, a, b }));
        if (bye !== null) pairings.push({ table: pairings.length + 1, a: bye, b: null });
        const rematches = pairs.filter(([a, b]) => played.has(pairKey(a, b))).length;
        return { pairings, rematches };
      }
    }
  }
  throw new Error("No fue posible emparejar la ronda.");
}
function pairPool(pool, played, points, allowRematch, budget) {
  const used = /* @__PURE__ */ new Set();
  const out = [];
  const step = () => {
    if (--budget.left < 0) return false;
    const p = pool.find((id) => !used.has(id));
    if (p === void 0) return true;
    used.add(p);
    const pp = points.get(p);
    const candidates = pool.filter((id) => !used.has(id)).map((id, idx) => ({ id, idx, gap: Math.abs(points.get(id) - pp), rematch: played.has(pairKey(p, id)) })).filter((c) => allowRematch || !c.rematch).sort((x, y) => Number(x.rematch) - Number(y.rematch) || x.gap - y.gap || x.idx - y.idx);
    for (const c of candidates) {
      used.add(c.id);
      out.push([p, c.id]);
      if (step()) return true;
      out.pop();
      used.delete(c.id);
      if (budget.left < 0) break;
    }
    used.delete(p);
    return false;
  };
  return step() ? out : null;
}

// src/elimination.ts
function seedOrder(size) {
  if (size < 1 || (size & size - 1) !== 0) throw new Error("El tama\xF1o del bracket debe ser potencia de 2.");
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
function firstEliminationRound(seeded) {
  if (seeded.length < 2) throw new Error("Se necesitan al menos 2 jugadores.");
  const size = nextPowerOfTwo(seeded.length);
  const order = seedOrder(size);
  const slot = (seed) => seeded[seed - 1] ?? null;
  const pairings = [];
  for (let i = 0; i < order.length; i += 2) {
    const a = slot(order[i]);
    const b = slot(order[i + 1]);
    if (a === null && b === null) continue;
    pairings.push(a === null ? { table: 0, a: b, b: null } : { table: 0, a, b });
  }
  return pairings.map((p, i) => ({ ...p, table: i + 1 }));
}
function nextEliminationRound(winnersInTableOrder) {
  if (winnersInTableOrder.length < 2) throw new Error("El torneo ya tiene campe\xF3n.");
  if (winnersInTableOrder.length % 2 !== 0) throw new Error("N\xFAmero impar de ganadores: el bracket est\xE1 incompleto.");
  const out = [];
  for (let i = 0; i < winnersInTableOrder.length; i += 2) {
    out.push({ table: i / 2 + 1, a: winnersInTableOrder[i], b: winnersInTableOrder[i + 1] });
  }
  return out;
}
function eliminationPlacement(totalRounds, eliminatedInRound) {
  if (eliminatedInRound === null) return { from: 1, to: 1 };
  const remaining = 2 ** (totalRounds - eliminatedInRound + 1);
  return { from: remaining / 2 + 1, to: remaining };
}

// src/structure.ts
function recommendedSwissRounds(players) {
  if (players < 2) return 0;
  if (players <= 3) return players - 1;
  if (players <= 8) return 3;
  if (players <= 16) return 4;
  if (players <= 32) return 5;
  if (players <= 64) return 6;
  if (players <= 128) return 7;
  return 8;
}
function recommendedTopCut(players) {
  if (players <= 8) return 0;
  if (players <= 32) return 4;
  return 8;
}
function eliminationRounds(players) {
  return players < 2 ? 0 : Math.ceil(Math.log2(players));
}
var TIMING = {
  /** El check-in del torneo abre antes de la hora de inicio y cierra al iniciar. */
  tournamentCheckInOpensBefore: 30,
  /** Tiempo para presentarse a la mesa ("ya estoy buscando") antes de declarar no-show. */
  roundCheckIn: 5,
  /** Duración de la ronda, incluido el check-in de mesa. Una partida de Pocket dura como máximo 40 min (20 por jugador). */
  round: { bo1: 25, bo3: 50 },
  /** Tras el reporte de un jugador, el rival tiene este tiempo para confirmar o disputar; después se confirma solo. */
  autoConfirm: 5,
  /** Pausa entre que se confirma la última mesa y se publica la siguiente ronda. */
  betweenRounds: 3,
  /** Pausa entre el final del suizo y el inicio del top cut. */
  beforeTopCut: 10
};
function estimateTournamentMinutes(d) {
  const swiss = recommendedSwissRounds(d.players);
  const swissRound = (d.swissBestOf === 1 ? TIMING.round.bo1 : TIMING.round.bo3) + TIMING.betweenRounds;
  let total = swiss * swissRound;
  if (d.topCut >= 2) {
    const topRound = (d.topCutBestOf === 1 ? TIMING.round.bo1 : TIMING.round.bo3) + TIMING.betweenRounds;
    total += TIMING.beforeTopCut + eliminationRounds(d.topCut) * topRound;
  }
  return total;
}

// src/ranking.ts
var RANKS = ["Explorador", "Rastreador", "Trampero", "Cazador", "Cazador Experto", "Maestro Cazador"];
var LEGEND = "Leyenda";
var PR_PER_DIVISION = 100;
var PR_PER_RANK = 300;
var LEGEND_THRESHOLD = RANKS.length * PR_PER_RANK;
var LEGEND_SLOTS = 100;
var PR_RULES = {
  matchWin: 15,
  matchLoss: -5,
  matchDraw: 5,
  placementBonus: { first: 60, second: 40, top4: 25, top8: 15 },
  multiplier: { casual: 0, comunitario: 1, clasificatorio: 1.5, mayor: 2 },
  minAccountPlayers: 8,
  /** Victorias contra el mismo rival que cuentan por semana. */
  winsPerRivalPerWeek: 2
};
function rankFromPR(pr, leaderboardPosition) {
  const p = Math.max(0, Math.floor(pr));
  if (p >= LEGEND_THRESHOLD && leaderboardPosition !== void 0 && leaderboardPosition <= LEGEND_SLOTS) {
    return { index: RANKS.length, name: LEGEND, division: `#${leaderboardPosition}`, progress: 0, toNext: null };
  }
  const capped = Math.min(p, LEGEND_THRESHOLD - 1);
  const index = Math.floor(capped / PR_PER_RANK);
  const within = capped - index * PR_PER_RANK;
  const div = Math.floor(within / PR_PER_DIVISION);
  const division = ["III", "II", "I"][div];
  const progress = within - div * PR_PER_DIVISION;
  const isTop = index === RANKS.length - 1 && div === 2;
  return {
    index,
    name: RANKS[index],
    division,
    progress: p >= LEGEND_THRESHOLD ? PR_PER_DIVISION - 1 : progress,
    toNext: isTop ? Math.max(0, LEGEND_THRESHOLD - p) : PR_PER_DIVISION - progress
  };
}
function tournamentPR(input) {
  const multiplier = PR_RULES.multiplier[input.category];
  const base = { wins: 0, losses: 0, draws: 0, placementBonus: 0, multiplier, total: 0 };
  if (multiplier === 0) return { ...base, eligible: false, reason: "Los torneos casuales no dan PR." };
  if (input.accountPlayers < PR_RULES.minAccountPlayers) {
    return { ...base, eligible: false, reason: `Se necesitan al menos ${PR_RULES.minAccountPlayers} jugadores con cuenta.` };
  }
  const wins = input.wins * PR_RULES.matchWin;
  const losses = input.losses * PR_RULES.matchLoss;
  const draws = input.draws * PR_RULES.matchDraw;
  const b = PR_RULES.placementBonus;
  const placementBonus = input.placement === 1 ? b.first : input.placement === 2 ? b.second : input.placement <= 4 ? b.top4 : input.placement <= 8 ? b.top8 : 0;
  const total = Math.round((wins + losses + draws + placementBonus) * multiplier);
  return { eligible: true, wins, losses, draws, placementBonus, multiplier, total };
}
function countableWins(winsAgainst, priorWinsThisWeek = {}, cap = PR_RULES.winsPerRivalPerWeek) {
  const seen = { ...priorWinsThisWeek };
  let count = 0;
  for (const rival of winsAgainst) {
    const n = seen[rival] ?? 0;
    if (n < cap) count++;
    seen[rival] = n + 1;
  }
  return count;
}
function applyPRDelta(current, delta, highestRankIndexReached) {
  const floor = Math.min(highestRankIndexReached, RANKS.length) * PR_PER_RANK;
  return Math.max(floor, Math.max(0, current + delta));
}
function seasonSoftReset(pr) {
  const index = Math.min(Math.floor(Math.max(0, pr) / PR_PER_RANK), RANKS.length);
  return Math.max(0, (index - 1) * PR_PER_RANK);
}

// src/medals.ts
var MEDALS = ["geoda", "cauce", "relampago", "savia", "vortice", "ponzona", "volcan", "astro"];
var MEDAL_INFO = {
  geoda: { name: "Geoda", how: "Jugar tu primer torneo de la temporada" },
  cauce: { name: "Cauce", how: "Jugar 5 torneos en la temporada" },
  relampago: { name: "Rel\xE1mpago", how: "Ganar un encuentro contra un rival de rango superior" },
  savia: { name: "Savia", how: "5 victorias de encuentro seguidas" },
  vortice: { name: "V\xF3rtice", how: "Terminar las rondas suizas sin derrotas" },
  ponzona: { name: "Ponzo\xF1a", how: "Top 4 en un torneo Comunitario o superior" },
  volcan: { name: "Volc\xE1n", how: "Top 8 en un torneo Clasificatorio o Mayor" },
  astro: { name: "Astro", how: "Ganar un torneo Comunitario o superior" }
};
var FINAL_INVITE_MEDALS = 6;
function isEligible(t) {
  return t.category !== "casual" && t.accountPlayers >= PR_RULES.minAccountPlayers;
}
function earnedMedals(history) {
  const eligible = history.filter(isEligible);
  const out = /* @__PURE__ */ new Set();
  if (eligible.length >= 1) out.add("geoda");
  if (eligible.length >= 5) out.add("cauce");
  const allMatches = eligible.flatMap((t) => t.matches).sort((x, y) => x.at - y.at);
  if (allMatches.some((m) => m.result === "win" && m.opponentRankIndex !== null && m.opponentRankIndex > m.ownRankIndex)) {
    out.add("relampago");
  }
  let streak = 0;
  for (const m of allMatches) {
    if (m.result === "bye") continue;
    streak = m.result === "win" ? streak + 1 : 0;
    if (streak >= 5) {
      out.add("savia");
      break;
    }
  }
  if (eligible.some((t) => t.swissRounds !== null && t.swissRounds >= 3 && t.swissLosses === 0)) out.add("vortice");
  if (eligible.some((t) => t.placement <= 4)) out.add("ponzona");
  if (eligible.some((t) => (t.category === "clasificatorio" || t.category === "mayor") && t.placement <= 8)) out.add("volcan");
  if (eligible.some((t) => t.placement === 1)) out.add("astro");
  return out;
}
function newMedals(before, history) {
  const had = new Set(before);
  const now = earnedMedals(history);
  return MEDALS.filter((m) => now.has(m) && !had.has(m));
}
var MEDAL_TITLES = {
  geoda: { forms: ["Debutante"] },
  cauce: { forms: ["Constante"] },
  relampago: { forms: ["Matagigantes"] },
  savia: { forms: ["En racha"] },
  vortice: { forms: ["Invicto", "Invicta"] },
  ponzona: { forms: ["Podio"] },
  volcan: { forms: ["\xC9lite"] },
  astro: { forms: ["Campe\xF3n", "Campeona"] }
};
var SEASON_TITLES = {
  finalista: { forms: ["Finalista"] },
  campeonTemporada: { forms: ["Campe\xF3n", "Campeona"] }
};
function titleLabel(info, form = "a", season) {
  const word = form === "b" && info.forms.length === 2 ? info.forms[1] : info.forms[0];
  return season === void 0 ? word : `${word} T${season}`;
}
function unlockedTitles(medalsEverEarned) {
  const had = new Set(medalsEverEarned);
  return MEDALS.filter((m) => had.has(m));
}

// src/conduct.ts
var RECONNECT_WAIT_MIN = 5;
function resolveDisconnect(s) {
  if (s.disconnectsThisMatch <= 1 && s.reconnectedInTime) return { action: "repetir_partida" };
  return {
    action: "partida_para_rival",
    note: s.reconnectedInTime ? "Segunda desconexi\xF3n en el mismo encuentro." : `No volvi\xF3 en ${RECONNECT_WAIT_MIN} minutos.`
  };
}
function disconnectSanction(confirmedInSeason) {
  if (confirmedInSeason <= 1) return { kind: "advertencia", prPenalty: 0, suspensionDays: 0, publicOnProfile: false };
  if (confirmedInSeason === 2) return { kind: "perdida_encuentro", prPenalty: -20, suspensionDays: 0, publicOnProfile: false };
  if (confirmedInSeason === 3) return { kind: "suspension", prPenalty: -40, suspensionDays: 14, publicOnProfile: true };
  return { kind: "revision_expulsion", prPenalty: -40, suspensionDays: 30, publicOnProfile: true };
}

// src/pace.ts
var SESSIONS = {
  /** El check-in de cada jornada abre antes de su inicio; sin check-in, el jugador queda fuera del torneo. */
  checkInOpensBefore: 30,
  /** Recordatorios antes de cada jornada, en minutos. */
  remindersBefore: [24 * 60, 60]
};
var WINDOW = {
  defaultHours: 24,
  options: [24, 48],
  /** Bloques de disponibilidad. */
  slotMinutes: 60,
  reminderBefore: 15,
  /** Tolerancia para presentarse a la hora acordada. */
  tableTolerance: 10,
  /** Tiempo del rival para confirmar un reporte. */
  autoConfirm: 60,
  /** Extensión máxima que el organizador puede dar a una mesa. */
  maxExtensionHours: 24
};
var HOUR = 36e5;
function roundDeadline(openedAt, windowHours, extensionHours = 0) {
  if (extensionHours < 0 || extensionHours > WINDOW.maxExtensionHours) {
    throw new Error(`La extensi\xF3n debe estar entre 0 y ${WINDOW.maxExtensionHours} horas.`);
  }
  return openedAt + (windowHours + extensionHours) * HOUR;
}
function firstCommonSlot(a, b, now, deadline, slotMs = WINDOW.slotMinutes * 6e4) {
  const theirs = new Set(b);
  const common = a.filter((t) => theirs.has(t) && t >= now && t + slotMs <= deadline).sort((x, y) => x - y);
  return common[0] ?? null;
}
function isActive(x, agreedTimeSet) {
  if (agreedTimeSet) return x.checkedInAtAgreedTime;
  return x.markedAvailability || x.proposedOrAccepted || x.checkedInAtAgreedTime;
}
function resolveAtDeadline(t) {
  if (t.disputeOpen) return "juez";
  if (t.confirmed) return "reportado";
  const a = isActive(t.a, t.agreedTimeSet);
  const b = isActive(t.b, t.agreedTimeSet);
  if (a && !b) return "victoria_a";
  if (b && !a) return "victoria_b";
  if (!a && !b) return "derrota_doble";
  return "juez";
}
function canCloseEarly(statuses) {
  return statuses.length > 0 && statuses.every((s) => s === "confirmada");
}
function bracketFeed(table) {
  if (table < 1) throw new Error("Las mesas empiezan en 1.");
  return { table: Math.ceil(table / 2), side: table % 2 === 1 ? "a" : "b" };
}
function estimateWindowDays(d) {
  const rounds = d.swissRounds + (d.topCut >= 2 ? eliminationRounds(d.topCut) : 0);
  return rounds * d.windowHours / 24;
}
function validateSessions(sessions, totalRounds) {
  const errors = [];
  const seen = /* @__PURE__ */ new Map();
  sessions.forEach((s, i) => {
    if (i > 0 && s.startsAt <= sessions[i - 1].startsAt) errors.push(`La jornada ${i + 1} empieza antes que la anterior.`);
    for (const r of s.rounds) seen.set(r, (seen.get(r) ?? 0) + 1);
  });
  let last = 0;
  for (const s of sessions) {
    for (const r of [...s.rounds].sort((x, y) => x - y)) {
      if (r < last) errors.push(`La ronda ${r} va en una jornada posterior a la ronda ${last}.`);
      last = Math.max(last, r);
    }
  }
  for (let r = 1; r <= totalRounds; r++) {
    const n = seen.get(r) ?? 0;
    if (n === 0) errors.push(`La ronda ${r} no est\xE1 en ninguna jornada.`);
    if (n > 1) errors.push(`La ronda ${r} est\xE1 en m\xE1s de una jornada.`);
  }
  return errors;
}

// src/deck.ts
var SAME_DECK_WITHIN_MATCH = true;
function defaultDeckPolicy(category) {
  if (category === "casual") return "libre";
  if (category === "comunitario") return "por_ronda";
  return "fijo";
}
function canDeclare(policy, round, pairingsPublished) {
  if (policy === "libre") return false;
  if (policy === "fijo") return round === 0;
  return !pairingsPublished;
}
function deckForRound(policy, declarations, round) {
  if (policy === "libre") return null;
  const valid = declarations.filter((d) => policy === "fijo" ? d.round === 0 : d.round <= round);
  return valid.reduce((best, d) => best === null || d.round >= best.round ? d : best, null);
}

// src/restrictions.ts
var POCKET_DECK = { size: 20, maxCopiesPerName: 2 };
function hasRestrictions(r) {
  return !!r.allowedSets?.length || r.upToReleaseOrder !== void 0 || !!r.bannedCards?.length || !!r.limitedCards?.length || r.ex !== void 0 && r.ex.kind !== "permitidos" || !!r.onlyDiamondRarity || !!r.noPromos || !!r.monotype || !!r.freeText?.trim();
}
function effectiveDeckPolicy(chosen, r) {
  return chosen === "libre" && hasRestrictions(r) ? "por_ronda" : chosen;
}
function validateRestrictionsConfig(r) {
  const e = [];
  if (r.allowedSets?.length && r.upToReleaseOrder !== void 0) e.push('Elige sets uno por uno o "hasta una expansi\xF3n", no las dos cosas.');
  if (r.ex?.kind === "maximo" && (!Number.isInteger(r.ex.count) || r.ex.count < 1)) e.push("El m\xE1ximo de ex debe ser un n\xFAmero entero de 1 o m\xE1s.");
  const both = (r.bannedCards ?? []).filter((c) => (r.limitedCards ?? []).includes(c));
  if (both.length) e.push(`Una carta no puede estar prohibida y limitada a la vez: ${both.join(", ")}.`);
  if (r.ex?.kind === "solo_ex" && r.onlyDiamondRarity) e.push('"Solo ex" y "solo rombos" pueden dejar el torneo sin mazos posibles; revisa la combinaci\xF3n.');
  return e;
}
function checkDeck(deck, r, db) {
  const out = [];
  const cards = deck.map((id) => {
    const c = db.get(id);
    if (!c) throw new Error(`Carta desconocida: ${id}`);
    return c;
  });
  if (cards.length !== POCKET_DECK.size) out.push(`El mazo tiene ${cards.length} cartas; deben ser ${POCKET_DECK.size}.`);
  const byName = /* @__PURE__ */ new Map();
  for (const c of cards) byName.set(c.name, (byName.get(c.name) ?? 0) + 1);
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  for (const [name, n] of byName) {
    if (n > POCKET_DECK.maxCopiesPerName) out.push(`${name}: ${n} copias; el m\xE1ximo es ${POCKET_DECK.maxCopiesPerName}.`);
  }
  for (const c of unique) {
    if (r.allowedSets?.length && !r.allowedSets.includes(c.set)) out.push(`${c.name} es de una expansi\xF3n no permitida.`);
    if (r.upToReleaseOrder !== void 0 && c.releaseOrder > r.upToReleaseOrder) out.push(`${c.name} es de una expansi\xF3n posterior a la permitida.`);
    if (r.bannedCards?.includes(c.id)) out.push(`${c.name} est\xE1 prohibida.`);
    if (r.limitedCards?.includes(c.id) && (byName.get(c.name) ?? 0) > 1) out.push(`${c.name} est\xE1 limitada a 1 copia.`);
    if (r.onlyDiamondRarity && !c.diamond) out.push(`${c.name} no es de rareza de rombos.`);
    if (r.noPromos && c.isPromo) out.push(`${c.name} es promo.`);
    if (r.monotype && c.kind === "pokemon" && c.type !== r.monotype) out.push(`${c.name} no es de tipo ${r.monotype}.`);
  }
  const pokemon = cards.filter((c) => c.kind === "pokemon");
  const exCount = pokemon.filter((c) => c.isEx).length;
  switch (r.ex?.kind) {
    case "prohibidos":
      if (exCount > 0) out.push("El torneo no permite Pok\xE9mon ex.");
      break;
    case "solo_ex":
      if (pokemon.some((c) => !c.isEx)) out.push("El torneo solo permite Pok\xE9mon ex.");
      break;
    case "sin_mega":
      if (pokemon.some((c) => c.isMega)) out.push("El torneo no permite Mega ex.");
      break;
    case "maximo":
      if (exCount > r.ex.count) out.push(`El mazo tiene ${exCount} cartas ex; el m\xE1ximo es ${r.ex.count}.`);
      break;
  }
  return out;
}
export {
  FINAL_INVITE_MEDALS,
  LEGEND,
  LEGEND_SLOTS,
  LEGEND_THRESHOLD,
  MATCH_POINTS,
  MEDALS,
  MEDAL_INFO,
  MEDAL_TITLES,
  POCKET_DECK,
  PR_PER_DIVISION,
  PR_PER_RANK,
  PR_RULES,
  RANKS,
  RECONNECT_WAIT_MIN,
  SAME_DECK_WITHIN_MATCH,
  SEASON_TITLES,
  SESSIONS,
  TIMING,
  WINDOW,
  applyPRDelta,
  bracketFeed,
  canCloseEarly,
  canDeclare,
  checkDeck,
  computeStandings,
  countableWins,
  deckForRound,
  defaultDeckPolicy,
  disconnectSanction,
  earnedMedals,
  effectiveDeckPolicy,
  eliminationPlacement,
  eliminationRounds,
  estimateTournamentMinutes,
  estimateWindowDays,
  firstCommonSlot,
  firstEliminationRound,
  hasRestrictions,
  hashString,
  isActive,
  isEligible,
  matchOutcome,
  newMedals,
  nextEliminationRound,
  nextPowerOfTwo,
  pairKey,
  pairSwissRound,
  playedPairs,
  rankFromPR,
  recommendedSwissRounds,
  recommendedTopCut,
  resolveAtDeadline,
  resolveDisconnect,
  roundDeadline,
  seasonSoftReset,
  seedOrder,
  seededRandom,
  shuffle,
  titleLabel,
  tournamentPR,
  unlockedTitles,
  validateRestrictionsConfig,
  validateSessions
};
