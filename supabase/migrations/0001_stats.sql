-- Sinople : compteurs de vues et de parties (étape « stats »).
-- Les tables sont fermées au public (RLS sans règle) : le site passe seulement par les trois fonctions
-- ci-dessous, qui vérifient ce qu'on leur envoie. Aucune donnée personnelle : un numéro de visiteur
-- tiré au hasard sur l'appareil, la page vue, et le score d'une leçon.

create table if not exists public.vues (
  id bigint generated always as identity primary key,
  page text not null check (char_length(page) between 1 and 120),
  visiteur uuid,
  cree_le timestamptz not null default now()
);
create index if not exists vues_cree_le on public.vues (cree_le);

create table if not exists public.parties (
  id bigint generated always as identity primary key,
  theme text not null check (char_length(theme) between 1 and 40),
  lecon text not null check (char_length(lecon) between 1 and 60),
  score smallint not null check (score between 0 and 100),
  reussie boolean not null,
  visiteur uuid,
  cree_le timestamptz not null default now()
);
create index if not exists parties_theme on public.parties (theme);

alter table public.vues enable row level security;
alter table public.parties enable row level security;
revoke all on public.vues, public.parties from anon, authenticated;

create or replace function public.compter_vue(p_page text, p_visiteur uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.vues (page, visiteur) values (left(p_page, 120), p_visiteur);
$$;

create or replace function public.compter_partie(p_theme text, p_lecon text, p_score int, p_reussie boolean, p_visiteur uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.parties (theme, lecon, score, reussie, visiteur)
  values (left(p_theme, 40), left(p_lecon, 60), greatest(0, least(100, p_score)), p_reussie, p_visiteur);
$$;

create or replace function public.stats_publiques()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'vues',          (select count(*) from public.vues),
    'vues_jour',     (select count(*) from public.vues where cree_le >= date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    'vues_7j',       (select count(*) from public.vues where cree_le >= now() - interval '7 days'),
    'visiteurs',     (select count(distinct visiteur) from public.vues),
    'visiteurs_7j',  (select count(distinct visiteur) from public.vues where cree_le >= now() - interval '7 days'),
    'parties',       (select count(*) from public.parties),
    'parties_reussies', (select count(*) from public.parties where reussie),
    'score_moyen',   (select round(avg(score)) from public.parties),
    'par_theme',     coalesce((select json_agg(t order by t.parties desc) from (
                        select theme, count(*) as parties, round(avg(score)) as score_moyen
                        from public.parties group by theme) t), '[]'::json),
    'pages',         coalesce((select json_agg(p order by p.vues desc) from (
                        select page, count(*) as vues from public.vues group by page order by count(*) desc limit 8) p), '[]'::json),
    'par_jour',      coalesce((select json_agg(j order by j.jour) from (
                        select to_char(d, 'YYYY-MM-DD') as jour,
                               (select count(*) from public.vues v
                                 where (v.cree_le at time zone 'Europe/Paris')::date = d) as vues
                        from generate_series((now() at time zone 'Europe/Paris')::date - 13, (now() at time zone 'Europe/Paris')::date, interval '1 day') g(d0),
                             lateral (select g.d0::date as d) x) j), '[]'::json)
  );
$$;

revoke all on function public.compter_vue(text, uuid), public.compter_partie(text, text, int, boolean, uuid), public.stats_publiques() from public;
grant execute on function public.compter_vue(text, uuid), public.compter_partie(text, text, int, boolean, uuid), public.stats_publiques() to anon, authenticated;
