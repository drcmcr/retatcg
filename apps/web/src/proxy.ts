import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se ven sin cuenta.
const PUBLIC = [/^\/$/, /^\/entrar/, /^\/auth\//, /^\/t\//, /^\/torneos$/, /^\/torneo\/[^/]+$/, /^\/jugador\//, /^\/beta-18/, /^\/guia/, /^\/legal/, /^\/api\/og/, /^\/manifest/, /^\/sw\.js/, /^\/offline/];

/** Refresca la sesión en cada petición y manda a /entrar a quien no tiene sesión en una ruta privada. */
export async function proxy(request: NextRequest) {
  // La ruta viaja en un encabezado para que los layouts sepan en qué torneo están.
  const reqHeaders = new Headers(request.headers);
  reqHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: reqHeaders } });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        const h = new Headers(request.headers);
        h.set("x-pathname", request.nextUrl.pathname);
        response = NextResponse.next({ request: { headers: h } });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && !PUBLIC.some((r) => r.test(path))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?siguiente=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|icons/|fonts/|.*\\.(?:png|jpg|svg|webp|woff2)$).*)"],
};
