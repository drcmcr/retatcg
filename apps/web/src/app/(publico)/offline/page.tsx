import { Iso } from "@/components/Brand";

export const metadata = { title: "Sin conexión" };

export default function Offline() {
  return (
    <main className="app">
      <div className="screen" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
        <Iso h={90} flat="#3A3A44" />
        <h1 className="t1">Sin conexión</h1>
        <p className="sm">Tu mesa y tu contraseña siguen guardadas. Vuelve a intentarlo en cuanto tengas internet.</p>
      </div>
    </main>
  );
}
