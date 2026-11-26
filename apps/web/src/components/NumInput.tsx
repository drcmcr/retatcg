"use client";
import { useState, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "min" | "max"> & {
  value: number;
  onValue: (n: number) => void;
  min: number;
  max: number;
};

/**
 * Campo numérico sin ceros a la izquierda. Se puede borrar y reescribir libremente;
 * al salir del campo se ajusta al mínimo y máximo.
 */
export function NumInput({ value, onValue, min, max, onBlur, ...rest }: Props) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  // Si el valor cambia desde fuera (por ejemplo, rondas recomendadas), se muestra el nuevo.
  if (value !== last) {
    setLast(value);
    if (text === "" || Number(text) !== value) setText(String(value));
  }
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, String(max).length);
        setText(t);
        if (t !== "") { const n = Number(t); setLast(n); onValue(n); }
      }}
      onBlur={(e) => {
        const n = Math.min(max, Math.max(min, text === "" ? min : Number(text)));
        setText(String(n));
        if (n !== value) { setLast(n); onValue(n); }
        onBlur?.(e);
      }}
    />
  );
}
