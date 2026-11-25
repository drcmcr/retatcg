import Link from "next/link";
import { Iso } from "@/components/Brand";

export const metadata = { title: "Beta para mayores de 18" };

export default function Beta18() {
  return (
    <main className="app">
      <div className="screen" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 18 }}>
        <Iso h={110} />
        <h1 className="t1">La beta es para mayores de 18</h1>
        <p className="sm" style={{ maxWidth: 34 + "ch" }}>
          Por ahora Reta solo admite adultos. No guardamos tus datos. Cuando abramos para todas las edades, te esperamos con tu tarjeta de cazador.
        </p>
        <Link href="/torneos" className="btn g" style={{ maxWidth: 320 }}>Ver torneos sin cuenta</Link>
      </div>
    </main>
  );
}
