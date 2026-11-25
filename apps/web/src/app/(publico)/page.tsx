import Link from "next/link";
import { redirect } from "next/navigation";
import { Iso, Logo } from "@/components/Brand";
import { FINAL_INVITE_MEDALS, LEGEND_SLOTS, LEGEND_THRESHOLD, MedalGrid, PACES, PRTable, RankLadder, SectionList } from "@/components/Explainers";
import { HunterCard } from "@/components/HunterCard";
import { Icon, type IconName } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { getMe, getUser } from "@/lib/auth";

export const metadata = { title: { absolute: "Reta · Torneos de TCG Pocket" } };

const STEPS = [
  ["Únete con un código", "El organizador te pasa un código o un QR. Te inscribes en segundos y, si hay cupo lleno, entras a la lista de espera."],
  ["Haz check-in", "Antes de empezar confirmas que estás. Si el torneo pide mazo, lo declaras desde la app; solo lo ve el staff."],
  ["Juega tu mesa", "Reta te da rival y una contraseña de partida privada lista para copiar en Pocket. Sin buscar a nadie por fuera."],
  ["Reporta y sigue", "Uno reporta, el otro confirma. La tabla, la siguiente ronda, los PR y las medallas se calculan solos."],
] as const;

const PERKS: { icon: IconName; title: string; text: string }[] = [
  { icon: "lock", title: "Contraseña automática", text: "Cada mesa recibe su contraseña de partida privada. Si no conecta, generas otra con un toque." },
  { icon: "swap", title: "Emparejamientos justos", text: "Suizo con top cut o eliminación directa, Bo1 o Bo3. Sin repetir rival y con desempates por fuerza de rivales." },
  { icon: "judge", title: "Juez dentro de la app", text: "Rival ausente, desconexión o marcador en disputa: abres un caso y el juez lo resuelve con el registro de la mesa." },
  { icon: "bell", title: "Avisos al teléfono", text: "Te avisa cuando sale tu emparejamiento, cuando tu rival reporta y cuando abre el check-in." },
  { icon: "msg", title: "Sin chat libre", text: "Con tu rival te comunicas con mensajes rápidos predefinidos. Nada de insultos ni datos de contacto." },
  { icon: "shield", title: "Tus datos, a salvo", text: "Tu ID de amigo y tu nombre en Pocket solo los ve tu rival de mesa y el staff del torneo." },
];

const STAFF: { icon: IconName; title: string; text: string }[] = [
  { icon: "plus", title: "Crea en minutos", text: "Categoría, formato, ritmo, cupo y reglas de mazo en un solo formulario, con estimado de duración." },
  { icon: "play", title: "Control de ronda", text: "Ve todas las mesas en vivo, pausa el reloj, da tiempo extra y avanza de ronda cuando todo cierra." },
  { icon: "judge", title: "Casos y sanciones", text: "Cada disputa llega con su historial. Resuelves, sancionas y todo queda en la auditoría." },
  { icon: "img", title: "Revisión de mazos", text: "Los jugadores suben su mazo; tú lo apruebas o lo rechazas contra las restricciones del torneo." },
];

export default async function Portada() {
  if (await getUser()) redirect((await getMe()) ? "/inicio" : "/bienvenida");
  return (
    <>
      <header className="lp-top">
        <div className="lp">
          <Link href="/" aria-label="Reta, inicio" style={{ textDecoration: "none" }}><Logo h={26} /></Link>
          <span className="grow" />
          <nav aria-label="Secciones de la portada">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#progresion">Rangos</a>
            <a href="#medallas">Medallas</a>
            <a href="#organizadores">Organizadores</a>
            <Link href="/guia">Guía</Link>
          </nav>
          <Link href="/entrar" className="btn p sm">Entrar</Link>
        </div>
      </header>

      <main>
        {/* Portada */}
        <section className="lp">
          <div className="lp-hero">
            <div className="col" style={{ gap: 18 }}>
              <span className="lp-kick"><Icon name="zap" size={18} />Beta abierta · Temporada 1</span>
              <h1 className="lp-h1">Torneos de TCG Pocket, <em>de la inscripción al campeón</em></h1>
              <p className="lp-lead">Reta empareja, te da la contraseña de cada partida, lleva la tabla y premia tu temporada con rangos, medallas y títulos. Tú solo juegas.</p>
              <div className="lp-ctas">
                <Link href="/entrar" className="btn p">Crear mi cuenta gratis</Link>
                <Link href="/torneos" className="btn g">Ver torneos abiertos</Link>
              </div>
              <span className="xs">Sin contraseñas: entras con un código que llega a tu correo. Beta para mayores de 18 años.</span>
            </div>
            <div className="lp-art chk n6">
              <div className="lp-art-in">
                <figure className="panel n6 col" style={{ margin: 0, gap: 10 }} aria-label="Ejemplo de una mesa en Reta">
                  <div className="row between">
                    <span className="lbl">Ronda 3 · Mesa 12</span>
                    <span className="pill l">En juego</span>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Identicon seed="reta-demo-rival-ambar" size={30} />
                    <span className="grow"><b>Ámbar</b> <span className="xs">· Rastreador I</span></span>
                    <span className="mono xs">Bo1</span>
                  </div>
                  <span className="xs">Contraseña de la partida</span>
                  <div className="row between">
                    <span className="mock-pass">K7QX2M9P</span>
                    <span className="ib n4" aria-hidden="true"><Icon name="copy" size={20} /></span>
                  </div>
                  <figcaption className="sr-only">Una mesa de ejemplo: rival, formato y la contraseña de partida privada lista para copiar.</figcaption>
                </figure>
                <HunterCard d={{ userId: "reta-demo-cazadora-nova", username: "Nova", pr: 742, medals: ["geoda", "cauce", "relampago", "savia"], titleMedal: "relampago", titleForm: "a", season: 1 }} />
              </div>
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="lp-sec">
          <div className="lp">
            <span className="lp-kick">Cómo funciona</span>
            <h2 className="lp-h2">Un torneo en cuatro pasos</h2>
            <ol className="lp-steps plain">
              {STEPS.map(([t, p]) => (
                <li key={t} className="lp-step n4"><h3>{t}</h3><p>{p}</p></li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ventajas */}
        <section className="lp-sec">
          <div className="lp">
            <span className="lp-kick">Por qué Reta</span>
            <h2 className="lp-h2">Todo lo que antes hacías en grupos de chat y hojas de cálculo</h2>
            <ul className="lp-grid plain">
              {PERKS.map((x) => (
                <li key={x.title} className="lp-card n4">
                  <span className="lp-ico n4" aria-hidden="true"><Icon name={x.icon} size={22} /></span>
                  <h3>{x.title}</h3>
                  <p>{x.text}</p>
                </li>
              ))}
            </ul>
            <h3 className="t2" style={{ marginTop: 10 }}>Tres ritmos para jugar</h3>
            <ul className="lp-grid plain">
              {PACES.map((x) => (
                <li key={x.name} className="lp-card n4">
                  <div className="row"><span className="lp-ico n4" aria-hidden="true"><Icon name={x.icon} size={22} /></span><h3>{x.name}</h3></div>
                  <p>{x.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Progresión */}
        <section id="progresion" className="lp-sec">
          <div className="lp">
            <span className="lp-kick">Progresión</span>
            <h2 className="lp-h2">Sube de rango con cada torneo</h2>
            <div className="lp-two">
              <div className="col" style={{ gap: 14 }}>
                <p className="lp-sub">Cada temporada juntas <b style={{ color: "var(--ink)" }}>PR</b> (puntos de ranking) en torneos Comunitarios, Clasificatorios y Mayores. Cada rango tiene tres divisiones (III, II, I) de 100 PR. Tu tarjeta de cazador cambia de acabado al subir.</p>
                <RankLadder />
                <p className="xs">Leyenda es para quien pasa de {LEGEND_THRESHOLD} PR y está entre los {LEGEND_SLOTS} mejores de la temporada.</p>
              </div>
              <div className="col" style={{ gap: 14 }}>
                <h3 className="t2">Así se ganan los PR</h3>
                <PRTable />
                <div className="tip l n4"><Icon name="shield" size={18} /><span>Puedes bajar de división, pero nunca por debajo del rango más alto que alcanzaste en la temporada. Al cerrarla, todos bajan un rango y vuelve la carrera.</span></div>
                <p className="xs">Para dar PR, un torneo necesita al menos 8 jugadores con cuenta. Contra el mismo rival cuentan como máximo 2 victorias por semana.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Medallas */}
        <section id="medallas" className="lp-sec">
          <div className="lp">
            <span className="lp-kick">Medallas y títulos</span>
            <h2 className="lp-h2">Ocho medallas por temporada</h2>
            <p className="lp-sub">Cada medalla desbloquea un título que se queda en tu perfil para siempre y que puedes lucir en tu tarjeta. Junta {FINAL_INVITE_MEDALS} en una temporada y recibes invitación a la Final de Temporada.</p>
            <MedalGrid />
          </div>
        </section>

        {/* Secciones */}
        <section className="lp-sec">
          <div className="lp">
            <div className="lp-two">
              <div className="col" style={{ gap: 14 }}>
                <span className="lp-kick">La app</span>
                <h2 className="lp-h2">Hecha para el teléfono</h2>
                <p className="lp-sub">Instálala en tu pantalla de inicio desde el navegador y funciona como una app: pantalla completa y avisos. No ocupa espacio de tienda.</p>
                <Link href="/guia/secciones" className="btn g" style={{ maxWidth: 320 }}>Recorre cada sección</Link>
              </div>
              <SectionList />
            </div>
          </div>
        </section>

        {/* Organizadores */}
        <section id="organizadores" className="lp-sec">
          <div className="lp">
            <span className="lp-kick">Para organizadores y jueces</span>
            <h2 className="lp-h2">Tu torneo corre solo; tú te encargas de la comunidad</h2>
            <ul className="lp-grid plain">
              {STAFF.map((x) => (
                <li key={x.title} className="lp-card n4">
                  <span className="lp-ico n4" aria-hidden="true"><Icon name={x.icon} size={22} /></span>
                  <h3>{x.title}</h3>
                  <p>{x.text}</p>
                </li>
              ))}
            </ul>
            <p className="sm">En la beta, el permiso de organizador lo da el equipo de Reta.</p>
          </div>
        </section>

        {/* Cierre */}
        <section className="lp-sec">
          <div className="lp">
            <div className="lp-band n6">
              <div className="panel n6 col" style={{ gap: 16, alignItems: "center", textAlign: "center", padding: "32px 18px" }}>
                <Iso h={84} />
                <h2 className="lp-h2">¿Listo para la caza?</h2>
                <p className="lp-sub">Crea tu cuenta, únete a un torneo y empieza a llenar tu tarjeta de la Temporada 1.</p>
                <div className="lp-ctas" style={{ justifyContent: "center", width: "100%" }}>
                  <Link href="/entrar" className="btn p">Crear mi cuenta</Link>
                  <Link href="/guia" className="btn g">Leer la guía</Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp">
          <Logo h={22} />
          <nav aria-label="Enlaces legales y de ayuda">
            <Link href="/guia">Guía</Link>
            <Link href="/torneos">Torneos</Link>
            <Link href="/legal/reglamento">Reglamento</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
          </nav>
          <p className="xs">Reta no está afiliada, patrocinada ni aprobada por The Pokémon Company, Nintendo, Creatures, GAME FREAK ni DeNA. Pokémon y TCG Pocket son marcas de sus respectivos dueños. Beta solo para mayores de 18 años.</p>
        </div>
      </footer>
    </>
  );
}
