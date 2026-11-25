// Guía de Reta: un capítulo por tema. Los números de PR, rangos y medallas vienen del motor.
import Link from "next/link";
import type { ReactNode } from "react";
import { FINAL_INVITE_MEDALS, LEGEND_SLOTS, LEGEND_THRESHOLD, MedalGrid, PACES, PR_RULES, PRTable, RankLadder, SectionList } from "@/components/Explainers";
import { Icon } from "@/components/Icon";

export type Chapter = { slug: string; title: string; summary: string; body: ReactNode };

const Tip = ({ tone = "c", children }: { tone?: "c" | "l" | "w"; children: ReactNode }) => (
  <div className={`tip n4 ${tone === "c" ? "" : tone}`}>
    <Icon name={tone === "w" ? "warn" : "info"} size={18} />
    <span>{children}</span>
  </div>
);

export const CHAPTERS: Chapter[] = [
  {
    slug: "primeros-pasos",
    title: "Primeros pasos",
    summary: "Crear tu cuenta, tu identidad de cazador e instalar la app.",
    body: (
      <>
        <h2>Tu cuenta</h2>
        <p>Entras con tu correo: te mandamos un <b>código de 6 dígitos</b> y lo escribes en la app. No hay contraseña que recordar. Si el correo trae un botón de “Entra directo”, también sirve, siempre que lo abras en el mismo navegador.</p>
        <Tip tone="w">La beta es solo para mayores de 18 años. Pedimos tu fecha de nacimiento al crear la cuenta y nadie más la ve.</Tip>
        <h2>Tu identidad</h2>
        <ul className="dots">
          <li><b>Usuario de Reta:</b> tu nombre público en tablas, ranking y tarjeta. De 3 a 16 caracteres. Lo puedes cambiar una vez cada 30 días.</li>
          <li><b>Nombre en Pocket e ID de amigo:</b> los necesita tu rival para encontrarte en el juego. Solo los ven tu rival de mesa y el staff del torneo.</li>
          <li><b>Tu ícono:</b> se genera solo a partir de tu cuenta. Es único, no se edita y no usa fotos.</li>
        </ul>
        <h2>Instala la app</h2>
        <p>Reta funciona en el navegador, pero instalada en tu pantalla de inicio se abre a pantalla completa y te puede mandar avisos.</p>
        <ol>
          <li><b>iPhone:</b> abre Reta en Safari, toca Compartir y luego “Agregar a inicio”. Abre Reta desde el ícono nuevo y activa los avisos.</li>
          <li><b>Android:</b> en Chrome, toca el menú y “Instalar app”, o acepta el aviso que aparece.</li>
        </ol>
        <Tip>Los avisos te dicen cuándo sale tu emparejamiento, cuándo tu rival reporta y cuándo abre el check-in. Los controlas en Perfil, Ajustes.</Tip>
      </>
    ),
  },
  {
    slug: "secciones",
    title: "Las secciones de la app",
    summary: "Qué hay en cada pestaña y para qué sirve el botón central.",
    body: (
      <>
        <p>Abajo tienes cinco botones. Cuatro llevan a una sección fija y el del centro cambia según lo que te toca hacer.</p>
        <SectionList />
        <h2>El botón central</h2>
        <ul className="dots">
          <li><b>Unirse:</b> cuando no tienes nada pendiente. Abre la pantalla para entrar a un torneo con código o QR.</li>
          <li><b>Check-in:</b> cuando un torneo donde estás inscrito abrió su check-in. Late para que no se te pase.</li>
          <li><b>Mesa 4</b> (o el número que sea): tu ronda está en juego. Te lleva directo a tu mesa.</li>
          <li><b>Coordinar:</b> en torneos por ventana, para acordar con tu rival cuándo jugar.</li>
          <li><b>Ronda 3</b> en gris: ya cerraste tu mesa y esperas la siguiente ronda.</li>
        </ul>
        <h2>Ajustes</h2>
        <p>Desde Perfil, el engrane: avisos de torneo y sociales, perfil privado, reducir movimiento, tus datos de Pocket, descargar tus datos o borrar tu cuenta.</p>
      </>
    ),
  },
  {
    slug: "torneos",
    title: "Entrar a un torneo",
    summary: "Categorías, ritmos, inscripción, check-in y mazos.",
    body: (
      <>
        <h2>Encuentra tu torneo</h2>
        <p>En <b>Torneos</b> ves los abiertos, los tuyos y los pasados. Si un organizador te pasó un código o un QR, usa <b>Unirse</b>.</p>
        <h2>Categorías</h2>
        <ul className="dots">
          <li><b>Casual:</b> para jugar por diversión. No da PR ni medallas.</li>
          <li><b>Comunitario:</b> la liga de tu comunidad. PR ×{PR_RULES.multiplier.comunitario}.</li>
          <li><b>Clasificatorio:</b> más competitivo, aprobado por el equipo de Reta. PR ×{PR_RULES.multiplier.clasificatorio}.</li>
          <li><b>Mayor:</b> los eventos grandes de la temporada. PR ×{PR_RULES.multiplier.mayor}.</li>
        </ul>
        <h2>Ritmos</h2>
        <ul className="dots">
          {PACES.map((p) => <li key={p.name}><b>{p.name}:</b> {p.text}</li>)}
        </ul>
        <h2>Formatos</h2>
        <ul className="dots">
          <li><b>Suizo:</b> todos juegan todas las rondas. Te emparejan con alguien de puntos parecidos y nunca repites rival.</li>
          <li><b>Suizo + top cut:</b> después del suizo, los mejores (top 4, 8…) pasan a eliminación directa.</li>
          <li><b>Eliminación directa:</b> quien pierde, sale.</li>
          <li><b>Bo1 / Bo3:</b> una partida o al mejor de tres.</li>
        </ul>
        <h2>Inscripción y check-in</h2>
        <ol>
          <li>Te inscribes desde la página del torneo. Si ya no hay cupo, entras a la lista de espera y subes solo cuando alguien se baja.</li>
          <li>Antes de empezar se abre el <b>check-in</b> (normalmente 30 minutos antes). Si no lo haces, no te emparejan.</li>
          <li>En torneos por ventana el check-in es automático: si estás inscrito, juegas.</li>
        </ol>
        <h2>Mazos</h2>
        <ul className="dots">
          <li><b>Libre:</b> juegas lo que quieras, no declaras nada.</li>
          <li><b>Por ronda:</b> antes de cada ronda subes la captura del mazo que vas a usar.</li>
          <li><b>Fijo:</b> declaras un mazo para todo el torneo.</li>
        </ul>
        <p>El torneo puede tener restricciones (cartas prohibidas, solo ex, sin Mega ex, rango mínimo). Las ves en la pestaña Info. Tu mazo solo lo ve el staff, que lo aprueba o te pide cambiarlo.</p>
        <Tip>¿No puedes seguir? Usa <b>Retirarme del torneo</b> desde la página del torneo. Así tu rival no espera y la tabla se mantiene limpia.</Tip>
      </>
    ),
  },
  {
    slug: "mesa",
    title: "Jugar tu mesa",
    summary: "Contraseña, mensajes rápidos, reportar resultado y qué hacer si algo sale mal.",
    body: (
      <>
        <h2>Antes de la partida</h2>
        <ol>
          <li>Abre tu mesa con el botón central. Ahí ves a tu rival, el formato y la <b>contraseña de partida</b>.</li>
          <li>Toca <b>Estoy en la mesa</b> para que tu rival y el juez sepan que llegaste.</li>
          <li>En Pocket: Batalla, Partida privada, y escribe la contraseña tal cual, en mayúsculas.</li>
        </ol>
        <Tip>Si no conecta, toca <b>Generar otra contraseña</b> debajo de la contraseña. A tu rival le llega la nueva al instante.</Tip>
        <h2>Mensajes rápidos</h2>
        <p>Con tu rival no hay chat libre. Tienes mensajes listos como “Ya estoy buscando partida”, “Dame 2 minutos” o “Buena partida”. Llegan como aviso a su teléfono. Puedes mandar uno cada 10 segundos.</p>
        <h2>Reportar el resultado</h2>
        <ol>
          <li>Al terminar, uno de los dos toca <b>Reportar</b> y marca cuántas partidas ganó cada quien.</li>
          <li>El otro lo <b>confirma</b> o lo <b>disputa</b>. Si no responde, se confirma solo después de unos minutos (en ventana, una hora).</li>
          <li>Si hay disputa, se abre un caso y el juez decide con el registro de la mesa.</li>
        </ol>
        <h2>Cuando algo sale mal</h2>
        <ul className="dots">
          <li><b>Rival ausente:</b> toca <b>Juez</b> y elige “Mi rival no se presenta”. El juez ve quién llegó y cuándo.</li>
          <li><b>Desconexión:</b> toca <b>Se cayó</b>. La primera vez, la partida se repite con contraseña nueva. Si vuelve a pasar o no regresas en 5 minutos, la partida es para tu rival.</li>
          <li><b>Cualquier otra cosa:</b> toca <b>Juez</b> y <b>Llamar al juez</b>. El caso aparece en tus avisos y puedes responder con capturas.</li>
        </ul>
        <h2>Por ventana: coordinar</h2>
        <p>Cada ronda tiene un plazo de 24 o 48 horas. Marca en qué horas puedes jugar o propón un horario; tu rival lo acepta con un toque. Marcar disponibilidad cuenta como estar activo. Al vencer el plazo, si solo uno estuvo activo, gana ese; si ninguno, pierden los dos; si los dos estuvieron activos y no jugaron, decide el juez.</p>
        <Tip tone="l">El bye (ronda libre) cuenta como victoria y no necesitas hacer nada.</Tip>
      </>
    ),
  },
  {
    slug: "rangos",
    title: "Rangos y PR",
    summary: "Cómo se ganan los puntos, los siete rangos y qué pasa al cerrar la temporada.",
    body: (
      <>
        <p>Los <b>PR</b> (puntos de ranking) miden tu temporada. Los ganas en torneos Comunitarios, Clasificatorios y Mayores con al menos {PR_RULES.minAccountPlayers} jugadores con cuenta.</p>
        <h2>Cómo se calculan</h2>
        <p>Sumas por cada encuentro y por tu lugar final, y el total se multiplica por la categoría del torneo.</p>
        <PRTable />
        <p>Ejemplo: en un Comunitario vas 4-1 y quedas segundo: 4 × 15 − 5 + 40 = <b>95 PR</b>. El mismo resultado en un Clasificatorio da 143 PR.</p>
        <Tip>Contra el mismo rival cuentan como máximo {PR_RULES.winsPerRivalPerWeek} victorias por semana. Así nadie infla su PR jugando siempre con la misma persona.</Tip>
        <h2>Los rangos</h2>
        <p>Hay seis rangos de 300 PR, cada uno con tres divisiones (III, II y I) de 100 PR. El séptimo, <b>Leyenda</b>, es para quien pasa de {LEGEND_THRESHOLD} PR y está entre los {LEGEND_SLOTS} mejores de la temporada.</p>
        <RankLadder />
        <h2>Tu piso y la temporada</h2>
        <ul className="dots">
          <li>Puedes perder PR y bajar de división, pero <b>nunca bajas del rango más alto</b> que alcanzaste en la temporada.</li>
          <li>Al cerrar la temporada hay un <b>reinicio suave</b>: todos bajan un rango y empiezan al inicio de ese rango.</li>
          <li>Tu tarjeta de cazador cambia de acabado con cada rango.</li>
        </ul>
      </>
    ),
  },
  {
    slug: "medallas",
    title: "Medallas y títulos",
    summary: "Las ocho medallas de la temporada, sus títulos y la Final.",
    body: (
      <>
        <p>Cada temporada tiene <b>8 medallas</b>. Solo cuentan los torneos que también dan PR. Se reinician con cada temporada, pero los títulos que desbloquean se quedan para siempre.</p>
        <MedalGrid />
        <h2>Títulos</h2>
        <p>Cada medalla que ganas desbloquea un título. Eliges cuál mostrar en <b>Perfil, Títulos</b>, y aparece en tu tarjeta y junto a tu nombre. Algunos tienen dos formas, como Invicto o Invicta: tú eliges.</p>
        <h2>Final de Temporada</h2>
        <p>Si juntas <b>{FINAL_INVITE_MEDALS} medallas</b> en una temporada, recibes invitación a la Final de Temporada. Sus finalistas y campeones ganan títulos exclusivos con el número de temporada.</p>
      </>
    ),
  },
  {
    slug: "perfil",
    title: "Tu perfil y tu tarjeta",
    summary: "Tarjeta de cazador, historial, estadísticas, privacidad y compartir.",
    body: (
      <>
        <h2>La tarjeta de cazador</h2>
        <p>Resume tu temporada: ícono, usuario, título, rango y división, PR, avance a la siguiente división y medallas. Es lo que ven los demás en tu perfil.</p>
        <h2>Qué más hay en Perfil</h2>
        <ul className="dots">
          <li><b>Medallas:</b> las que tienes y cómo ganar las que faltan.</li>
          <li><b>Títulos:</b> elige cuál lucir.</li>
          <li><b>Rangos y temporada:</b> tu posición en el ranking y los PR de cada torneo.</li>
          <li><b>Historial y estadísticas:</b> torneos jugados, récord, lugares y tus rivales más frecuentes.</li>
        </ul>
        <h2>Compartir</h2>
        <p>Con el botón de compartir generas una imagen de tu tarjeta para historias (vertical) o publicaciones. No incluye tu ID de amigo ni datos privados.</p>
        <h2>Perfil privado</h2>
        <p>En Ajustes puedes hacer tu perfil privado: solo te ve quien juega contigo y sales del ranking público. Tus PR y medallas siguen contando.</p>
      </>
    ),
  },
  {
    slug: "comunidad",
    title: "Comunidad y seguridad",
    summary: "Seguir, bloquear, reportar y las reglas de convivencia.",
    body: (
      <>
        <h2>Comunidad</h2>
        <ul className="dots">
          <li><b>Ranking:</b> los mejores de la temporada por PR.</li>
          <li><b>Seguir:</b> sigue a otros cazadores y filtra el ranking para ver solo a quienes sigues. Con los avisos sociales activos, te avisamos cuando alguien te sigue.</li>
          <li><b>Buscar:</b> encuentra jugadores por su usuario.</li>
        </ul>
        <h2>Cómo cuidamos la convivencia</h2>
        <ul className="dots">
          <li><b>Sin chat libre:</b> solo mensajes rápidos predefinidos y “Llamar juez”.</li>
          <li><b>Sin datos de contacto:</b> nadie ve tu correo. Tu ID de amigo y nombre en Pocket solo los ven tu rival de mesa y el staff.</li>
          <li><b>Bloquear:</b> desde el perfil de alguien. Se deshacen los seguimientos entre ustedes y no puede volver a seguirte.</li>
          <li><b>Reportar:</b> si un nombre o una conducta es ofensiva, repórtala desde su perfil. La revisa el equipo de Reta.</li>
        </ul>
        <h2>Sanciones</h2>
        <p>Los jueces pueden dar advertencias, pérdida de encuentro o suspensiones. Las desconexiones confirmadas a propósito suben de nivel en la temporada. Consulta el <Link href="/legal/reglamento">reglamento</Link> completo.</p>
      </>
    ),
  },
  {
    slug: "staff",
    title: "Organizar y arbitrar",
    summary: "Panel del staff: crear torneos, control de ronda, casos, mazos y auditoría.",
    body: (
      <>
        <p>Si eres organizador o juez, en Perfil aparece la entrada al <b>panel del staff</b>. En la beta, el permiso de organizador lo da el equipo de Reta.</p>
        <h2>Crear un torneo</h2>
        <ol>
          <li><b>Staff, Crear torneo.</b> Nombre, fecha, cupo y categoría. Los Clasificatorios y Mayores esperan la aprobación del superadmin.</li>
          <li><b>Formato y ritmo:</b> suizo, suizo con top cut o eliminación; Bo1 o Bo3; en vivo, por jornadas o por ventana. Abajo ves cuánto duraría en el peor caso.</li>
          <li><b>Mazos:</b> libre, por ronda o fijo, y restricciones si las quieres.</li>
          <li><b>Crear y abrir inscripción</b>, o guárdalo como borrador.</li>
        </ol>
        <h2>Durante el torneo</h2>
        <ul className="dots">
          <li><b>Control de ronda:</b> inicia el torneo, ve todas las mesas y su estado, pausa o reanuda el reloj, agrega minutos y pasa a la siguiente ronda.</li>
          <li><b>Mesa:</b> recuerda a los jugadores, extiende su tiempo, pide repetir la partida o pon el resultado (siempre con motivo; queda registrado).</li>
          <li><b>Casos:</b> cada disputa, ausencia o llamada al juez, con su historial. Responde, resuelve y sanciona.</li>
          <li><b>Revisar mazos:</b> aprueba o rechaza cada declaración.</li>
          <li><b>Inscritos y staff:</b> haz check-in por alguien, da de baja inscritos, agrega invitados sin cuenta y suma jueces. La lista de espera sube sola.</li>
          <li><b>Anuncio:</b> un mensaje fijo que ven todos los jugadores del torneo.</li>
          <li><b>Auditoría:</b> cada acción del staff queda guardada con quién, cuándo y por qué.</li>
        </ul>
        <Tip>Los invitados sin cuenta pueden jugar, pero no suman al mínimo de {PR_RULES.minAccountPlayers} jugadores con cuenta que hace falta para dar PR.</Tip>
        <h2>Al terminar</h2>
        <p>Cuando cierra la última ronda, Reta calcula lugares, PR, medallas y títulos, y avisa a cada jugador. No tienes que capturar nada.</p>
      </>
    ),
  },
];

export function chapterIndex(slug: string) {
  return CHAPTERS.findIndex((c) => c.slug === slug);
}
