-- Reta · filtro de nombres: "nebula.mx" es un usuario normal, no un enlace.
-- En nombres (usuario, invitado, torneo, club) no se revisan dominios sueltos; en textos sí.

create or replace function public._has_contact(p text, p_domains boolean default true)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p, '') ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+'
      or coalesce(p, '') ~* '(https?://|www\.|wa\.me|t\.me/)'
      or (p_domains and coalesce(p, '') ~* '[a-z0-9-]+\.(com|mx|net|org|gg|io|me|ly|app|link|xyz|co|tv|lat|info|site|store)(/|\y)')
      or coalesce(p, '') ~* '(^|[^a-z0-9])@[a-z0-9_.]{3,}'
      or coalesce(p, '') ~ '(\+?\d{1,3}[ -]?)?\(?\d{2,3}\)?[ -]?\d{3,4}[ -]?\d{4}'
$$;

create or replace function public._text_issue(p_text text, p_field text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare words text; compact text; t record;
begin
  if nullif(trim(coalesce(p_text, '')), '') is null then return null; end if;
  if public._has_contact(p_text, p_field = 'texto') then return 'contacto'; end if;
  words := public._norm_words(p_text);
  for t in select norm from public.blocked_terms where kind = 'permitido' loop
    words := replace(words, t.norm, '');
  end loop;
  compact := regexp_replace(replace(words, ' ', ''), '([a-z0-9])\1+', '\1', 'g');
  for t in select kind, norm, whole_word from public.blocked_terms
           where kind <> 'permitido' and p_field = any (fields)
           order by case kind when 'contacto' then 0 when 'ofensivo' then 1 when 'marca' then 2 else 3 end loop
    if (t.whole_word and position(' ' || t.norm || ' ' in words) > 0)
       or (not t.whole_word and position(t.norm in compact) > 0) then
      return t.kind;
    end if;
  end loop;
  return null;
end $$;

drop function if exists public._has_contact(text);
