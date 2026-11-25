"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { follow, unfollow } from "@/actions/profile";
import { useAction } from "@/components/client";
import { Icon } from "@/components/Icon";
import { Identicon } from "@/components/Identicon";
import { supabaseBrowser } from "@/lib/supabase/client";

export function Search({ initial, followed, meId }: { initial: string; followed: string[]; meId: string }) {
  const [q, setQ] = useState(initial);
  const [res, setRes] = useState<{ id: string; username: string }[]>([]);
  const { run, pending } = useAction();
  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(async () => {
      const { data } = await supabaseBrowser().from("profiles").select("id,username").ilike("username", `%${q.trim().replace(/[%_]/g, "\\$&")}%`).neq("id", meId).limit(20);
      setRes(data ?? []);
    }, 250);
    return () => clearTimeout(id);
  }, [q, meId]);
  return (
    <>
      <label className="inp" style={{ gap: 8 }}><Icon name="search" size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por usuario de Reta" aria-label="Buscar jugadores" autoCapitalize="none" /></label>
      <div className="list">
        {(q.trim().length < 2 ? [] : res).map((r) => (
          <div key={r.id} className="li n4">
            <Identicon seed={r.id} size={36} />
            <Link href={`/jugador/${r.username}`} className="grow ttl" style={{ color: "var(--ink)", textDecoration: "none" }}>{r.username}</Link>
            {followed.includes(r.id)
              ? <button className="btn g sm" disabled={pending} onClick={() => run(() => unfollow(r.id))}>Siguiendo</button>
              : <button className="btn p sm" disabled={pending} onClick={() => run(() => follow(r.id), { ok: `Sigues a ${r.username}.` })}>Seguir</button>}
          </div>
        ))}
        {q.trim().length >= 2 && !res.length && <p className="sm">Nadie con ese usuario.</p>}
      </div>
      <p className="xs">Seguir es de un solo lado y no pide aprobación.</p>
    </>
  );
}
