"use client";
import { markRead } from "@/actions/profile";
import { ActionButton } from "@/components/client";

export function MarkAll() {
  return <ActionButton className="link" action={() => markRead()} ok="Listo.">Marcar leídos</ActionButton>;
}
