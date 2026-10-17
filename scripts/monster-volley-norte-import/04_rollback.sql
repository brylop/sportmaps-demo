-- Deshace la carga de la Sede Norte (2026-10-14). Orden inverso.
-- Los archivos en Storage (identity-documents y avatars bajo
-- unregistered_athletes/<id>/) NO se borran desde SQL: hacerlo desde el panel.
begin;
with ua as (
  select id from public.unregistered_athletes
  where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
    and branch_id = 'e2918c8d-b510-4f7f-9b05-e73a5e8edb68'
)
, d1 as (delete from public.athlete_documents where unregistered_athlete_id in (select id from ua))
, d2 as (delete from public.enrollment_categories where enrollment_id in (select id from public.enrollments where unregistered_athlete_id in (select id from ua)))
, d3 as (delete from public.enrollments where unregistered_athlete_id in (select id from ua))
select 1;
delete from public.unregistered_athletes
 where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and branch_id = 'e2918c8d-b510-4f7f-9b05-e73a5e8edb68';
delete from public.teams where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and category_id in (select id from public.school_categories where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c' and code like 'N%' and branch_id = 'e2918c8d-b510-4f7f-9b05-e73a5e8edb68');
delete from public.school_categories where school_id = 'eb3ebc77-4ea4-4992-96c8-3c8ec574578c'
   and code like 'N%' and branch_id = 'e2918c8d-b510-4f7f-9b05-e73a5e8edb68';
commit;
