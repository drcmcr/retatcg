import { TopBar } from "@/components/ui";
import { JoinForm } from "./JoinForm";

export const metadata = { title: "Unirse" };

export default function Unirse() {
  return (
    <main className="screen">
      <TopBar title="Unirse" back="/torneos" />
      <h2 className="t1">Código del torneo</h2>
      <JoinForm />
      <p className="sm">En torneos presenciales, el organizador proyecta un QR: escanéalo con la cámara de tu teléfono y te trae directo aquí.</p>
    </main>
  );
}
