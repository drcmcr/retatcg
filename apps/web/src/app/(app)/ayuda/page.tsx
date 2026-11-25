import Link from "next/link";
import { TopBar } from "@/components/ui";

export const metadata = { title: "Ayuda" };

const FAQ = [
  ["¿Cómo creo la partida privada?", "En Pocket: Batalla, Partida privada. Escribe la contraseña de tu mesa tal cual, en mayúsculas. Si no conecta, genera una nueva desde la mesa."],
  ["¿Qué hago si mi rival no se presenta?", "En la mesa toca Juez y elige \"Mi rival no se presenta\". El juez revisa el registro de la mesa."],
  ["¿Qué pasa si me desconecto?", "La primera vez, la partida se repite con contraseña nueva. Si te desconectas otra vez o no vuelves en 5 minutos, la partida es para tu rival y el juez revisa si hay sanción."],
  ["¿Cómo se ganan los PR?", "Victoria +15, derrota −5, empate +5, más un bono por lugar (campeón +60, segundo +40, top 4 +25, top 8 +15). Se multiplica por la categoría: Comunitario ×1, Clasificatorio ×1.5, Mayor ×2. Los Casuales no dan PR y se necesitan al menos 8 jugadores con cuenta."],
  ["¿Cómo funcionan las medallas?", "Hay 8 por temporada. Cada una desbloquea un título que se queda para siempre. Con 6 tienes invitación a la Final de Temporada."],
  ["¿Qué es el ritmo por ventana?", "Cada ronda tiene un plazo (24 o 48 h). Marca tu disponibilidad o propón un horario: eso cuenta como estar activo. Al vencer el plazo, si solo uno estuvo activo, gana; si ninguno, derrota para los dos; si los dos, decide el juez."],
];

export default function Ayuda() {
  return (
    <main className="screen">
      <TopBar title="Ayuda" back="/ajustes" />
      <div className="list">
        {FAQ.map(([q, a]) => (
          <details key={q} className="box n4">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>{q}</summary>
            <p className="sm" style={{ marginTop: 8 }}>{a}</p>
          </details>
        ))}
      </div>
      <Link href="/legal/reglamento" className="btn g">Reglamento de juego</Link>
      <p className="xs">¿Algo más? Llama al juez desde tu mesa o escribe al organizador de tu torneo.</p>
    </main>
  );
}
