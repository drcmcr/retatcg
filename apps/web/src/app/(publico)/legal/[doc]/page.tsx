import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";

const DOCS: Record<string, { title: string; body: string[] }> = {
  privacidad: {
    title: "Aviso de privacidad (beta)",
    body: [
      "Reta es una beta cerrada para mayores de 18 años. Esta versión del aviso es un borrador y se revisará con asesoría legal antes del lanzamiento público.",
      "Qué guardamos: tu correo (para entrar), tu fecha de nacimiento (solo para confirmar tu edad; nadie más la ve), tu usuario, tu nombre en Pocket y tu ID de amigo (solo los ve tu rival de mesa y el staff del torneo), tus resultados, PR, medallas y títulos, y el registro de tus mesas y casos.",
      "Para qué: organizar torneos, emparejarte, mostrar tablas y rankings, resolver disputas y avisarte de tus rondas. No vendemos tus datos ni mostramos publicidad.",
      "Qué es público: tu usuario, ícono, rango, títulos, medallas y resultados en torneos. Puedes hacer tu perfil privado en Ajustes.",
      "Tus derechos: puedes descargar tus datos y eliminar tu cuenta desde Ajustes, Privacidad. Tu cuenta se borra a los 7 días; tus resultados quedan como \"Jugador eliminado\" para no alterar las tablas de otros.",
      "Conservación: si empiezas el registro y no lo terminas, borramos esos datos a los 7 días. Si no usas Reta durante 12 meses, te avisamos en la app y, si no vuelves en 30 días, borramos tu cuenta de la misma forma.",
      "Dónde se guardan: en servicios de infraestructura (Supabase y Vercel) que procesan los datos por cuenta de Reta.",
    ],
  },
  terminos: {
    title: "Términos de uso (beta)",
    body: [
      "Reta es una herramienta gratuita para organizar y jugar torneos de Pokémon TCG Pocket. No está afiliada, patrocinada ni aprobada por The Pokémon Company, Nintendo, Creatures, GAME FREAK ni DeNA. Pokémon y TCG Pocket son marcas de sus respectivos dueños.",
      "Debes tener 18 años o más para usar la beta.",
      "No suplantes a otras personas, no uses nombres ofensivos y no manipules resultados. El staff puede sancionar, suspender o expulsar según el reglamento.",
      "Organizadores y clubes: quien organiza un torneo responde por el nombre del torneo, el nombre de su club y los textos que publica (notas, premios y anuncios). No puede usar marcas ajenas de forma que haga creer que el torneo es oficial o que está afiliado, patrocinado o aprobado por el dueño de la marca, ni publicar datos de contacto. Los premios los ofrece y entrega quien organiza, no Reta.",
      "Reta puede cambiar o quitar nombres y textos que no cumplan estas reglas, que generen confusión o que reciban una queja, y avisará al organizador.",
      "Titulares de derechos: si crees que un nombre o contenido en Reta usa tu marca o tu obra sin permiso, escríbenos a retatcg.app@gmail.com con el enlace y una breve explicación. Lo revisamos y, si procede, lo retiramos a la brevedad.",
      "La beta puede cambiar, fallar o reiniciarse. Haremos lo posible por conservar tus resultados.",
    ],
  },
  reglamento: {
    title: "Reglamento de juego",
    body: [
      "Puntos por encuentro: victoria 3, empate 1, derrota 0. Desempates: OMW%, OOMW%, GW% (piso de 25%), enfrentamiento directo y sorteo con semilla guardada.",
      "Mesa: entra con la contraseña de la mesa y marca \"Estoy en la mesa\". Tienes 5 minutos para presentarte. Reporta el resultado al terminar; tu rival lo confirma o lo disputa. Si no responde, se confirma solo (5 min en vivo, 60 min por ventana).",
      "Desconexiones: la primera se repite la partida; la segunda o no volver en 5 minutos da la partida a quien se quedó. Las desconexiones injustificadas confirmadas por un juez acumulan sanciones: advertencia; pérdida del encuentro y −20 PR; suspensión de 14 días y −40 PR; revisión de expulsión.",
      "Mazo: según el torneo puede ser libre, por ronda (declarado antes del emparejamiento) o fijo. Dentro de un Bo3 se usa el mismo mazo. Mazo con 20 cartas y máximo 2 copias por nombre.",
      "Comunicación: no hay chat; solo mensajes rápidos y llamada al juez. No compartas datos de contacto.",
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  return { title: DOCS[(await params).doc]?.title ?? "Legal" };
}

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const d = DOCS[(await params).doc];
  if (!d) notFound();
  return (
    <main className="app">
      <div className="screen">
        <div className="tb"><Link href="/" className="ib" aria-label="Volver"><Icon name="back" /></Link></div>
        <h1 className="t1">{d.title}</h1>
        {d.body.map((p, i) => <p key={i} className="sm" style={{ color: "var(--ink-3)" }}>{p}</p>)}
      </div>
    </main>
  );
}
