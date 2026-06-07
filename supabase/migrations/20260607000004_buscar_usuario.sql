-- ============================================================================
-- ARRIENDA+ — RPC para resolver un usuario por email (Fase 0).
--
-- RLS impide que un arrendador lea perfiles ajenos, pero al crear un contrato
-- necesita ubicar al arrendatario por su email. Esta funcion SECURITY DEFINER
-- expone solo id/rol/nombre del usuario con ese email (sistema cerrado).
-- ============================================================================
create or replace function public.buscar_usuario_por_email(p_email text)
returns table (id uuid, rol public.rol, nombre text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.id, p.rol, p.nombre
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.buscar_usuario_por_email(text) from public;
grant execute on function public.buscar_usuario_por_email(text) to authenticated;
