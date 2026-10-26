-- =====================================================================
--  Gestor Campos · esquema, seguridad y funciones para Supabase
--  Ejecutar en Supabase > SQL Editor (es idempotente: se puede repetir).
--  DESPUÉS, una sola vez, autoriza tu email (el del usuario creado en Authentication):
--    insert into public.propietario (email) values ('tu-email@ejemplo.com');
-- =====================================================================

-- 0. ¿Quién puede usar la app? Solo los emails de la tabla `propietario`.
--    La tabla no es accesible desde la API (RLS sin políticas): se gestiona desde el SQL Editor.
create table if not exists public.propietario (
  email text primary key check (email = lower(btrim(email)))
);
alter table public.propietario enable row level security;
revoke all on public.propietario from anon, authenticated;

create or replace function public.es_propietario() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.propietario
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
$$;
revoke execute on function public.es_propietario() from public, anon;
grant execute on function public.es_propietario() to authenticated;

-- 1. Tablas (mismo esquema que usaba TypeORM) -------------------------------
create table if not exists public.campo (
  id serial primary key,
  nombre varchar not null,
  tamano numeric(12,4) not null,
  poligono int not null,
  parcela int not null
);

create table if not exists public.categoria (
  id serial primary key,
  nombre varchar(60) not null unique,
  color varchar(9) not null default '#8b949e'
);

create table if not exists public.pago (
  id serial primary key,
  fecha timestamp not null,
  nombre varchar not null,
  descripcion text not null default '',
  coste numeric(12,2) not null,
  anio int,
  "campoId" int references public.campo(id) on delete cascade,
  "categoriaId" int references public.categoria(id) on delete set null
);

create table if not exists public.cheque (
  id serial primary key,
  dia timestamp not null,
  cantidad numeric(12,2) not null,
  anio int,
  "campoId" int references public.campo(id) on delete cascade
);

-- 1b. Si las tablas ya existían con el esquema antiguo: columnas nuevas y float -> numeric
alter table public.pago add column if not exists "categoriaId" int references public.categoria(id) on delete set null;
-- ¿Está pagado del todo? Los pagos que ya existían se dan por pagados.
alter table public.pago add column if not exists pagado boolean not null default true;

do $$
declare r record;
begin
  for r in select * from (values
      ('campo','tamano','numeric(12,4)',4),
      ('pago','coste','numeric(12,2)',2),
      ('cheque','cantidad','numeric(12,2)',2)) as t(tabla, columna, tipo, escala)
  loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = r.tabla
                 and column_name = r.columna and data_type = 'double precision') then
      execute format('alter table public.%I alter column %I type %s using round(%I::numeric, %s)',
                     r.tabla, r.columna, r.tipo, r.columna, r.escala);
    end if;
  end loop;
end $$;

-- 2. Validación en la base de datos (sustituye a la del antiguo servidor) -----
--    NOT VALID: no revisa filas antiguas, solo las nuevas o modificadas.
do $$
declare r record;
begin
  for r in select * from (values
      ('campo','campo_nombre_ok',    $c$length(btrim(nombre)) > 0$c$),
      ('campo','campo_tamano_ok',    $c$tamano > 0$c$),
      ('campo','campo_numeros_ok',   $c$poligono >= 0 and parcela >= 0$c$),
      ('pago','pago_nombre_ok',      $c$length(btrim(nombre)) > 0$c$),
      ('pago','pago_coste_ok',       $c$coste >= 0$c$),
      ('pago','pago_anio_ok',        $c$anio is null or anio between 1989 and 2100$c$),
      ('pago','pago_fecha_ok',       $c$fecha >= '1990-01-01' and fecha < '2101-01-01'$c$),
      ('cheque','cheque_cantidad_ok',$c$cantidad > 0$c$),
      ('cheque','cheque_anio_ok',    $c$anio is null or anio between 1989 and 2100$c$),
      ('cheque','cheque_dia_ok',     $c$dia >= '1990-01-01' and dia < '2101-01-01'$c$),
      ('categoria','categoria_nombre_ok', $c$length(btrim(nombre)) > 0$c$),
      ('categoria','categoria_color_ok',  $c$color ~ '^#[0-9a-fA-F]{6}$'$c$)
    ) as t(tabla, nombre, condicion)
  loop
    if not exists (select 1 from pg_constraint where conname = r.nombre) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', r.tabla, r.nombre, r.condicion);
    end if;
  end loop;
end $$;

-- 3. Seguridad: solo usuarios autenticados Y de la lista de es_propietario() ---
alter table public.campo     enable row level security;
alter table public.categoria enable row level security;
alter table public.pago      enable row level security;
alter table public.cheque    enable row level security;

drop policy if exists propietario on public.campo;
drop policy if exists propietario on public.categoria;
drop policy if exists propietario on public.pago;
drop policy if exists propietario on public.cheque;

create policy propietario on public.campo     for all to authenticated using (public.es_propietario()) with check (public.es_propietario());
create policy propietario on public.categoria for all to authenticated using (public.es_propietario()) with check (public.es_propietario());
create policy propietario on public.pago      for all to authenticated using (public.es_propietario()) with check (public.es_propietario());
create policy propietario on public.cheque    for all to authenticated using (public.es_propietario()) with check (public.es_propietario());

revoke all on public.campo, public.categoria, public.pago, public.cheque from anon;
grant select, insert, update, delete on public.campo, public.categoria, public.pago, public.cheque to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- 4. Categorías por defecto -------------------------------------------------
insert into public.categoria (nombre, color) values
  ('Semillas y plantas',          '#3fb950'),
  ('Abonos y fitosanitarios',     '#d29922'),
  ('Combustible',                 '#f0883e'),
  ('Maquinaria y mantenimiento',  '#a371f7'),
  ('Mano de obra',                '#58a6ff'),
  ('Riego y agua',                '#39c5cf'),
  ('Seguros e impuestos',         '#ff7b72'),
  ('Arrendamiento',               '#db61a2'),
  ('Sin categoría',               '#8b949e')
on conflict (nombre) do nothing;

-- 5. Funciones ---------------------------------------------------------------

-- 5a. Clasifica por palabras clave los pagos que aún no tienen categoría
create or replace function public.categorizar_pagos() returns int
language plpgsql as $$
declare n int;
begin
  with reglas(orden, categoria, palabras) as (values
    (1, 'Semillas y plantas',         array['semilla','planta','planton','injerto','esqueje','simiente','vivero']),
    (2, 'Abonos y fitosanitarios',    array['abono','fertiliz','nitrato','herbicida','fungicida','insecticida','fitosanit','tratamiento','azufre','cobre','purin','estiercol','producto']),
    (3, 'Combustible',                array['gasoil','gasoleo','diesel','combustible','gasolina','carburante']),
    (4, 'Maquinaria y mantenimiento', array['tractor','maquinaria','reparac','mantenim','recambio','aceite','neumatic','rueda','cosechadora','apero','taller','motocultor','desbrozadora']),
    (5, 'Mano de obra',               array['jornal','mano de obra','peon','trabajador','nomina','sueldo','salario','recolec','poda','cosecha','vendimia','recogida','personal','cuadrilla']),
    (6, 'Riego y agua',               array['riego','agua','goteo','bomba','acequia','regante','pozo','tuberia','electricidad','luz']),
    (7, 'Seguros e impuestos',        array['seguro','ibi','impuesto','tasa','contribucion','seguridad social','autonomo','gestoria','asesor','cuota']),
    (8, 'Arrendamiento',              array['alquiler','arrendamiento','renta','arriendo'])
  ),
  candidatos as (
    select p.id,
      (select r.categoria from reglas r
        where exists (select 1 from unnest(r.palabras) w
                      where translate(lower(p.nombre || ' ' || coalesce(p.descripcion, '')), 'áéíóúü', 'aeiouu') like '%' || w || '%')
        order by r.orden limit 1) as cat
    from public.pago p
    where p."categoriaId" is null
  )
  update public.pago p
     set "categoriaId" = (select c.id from public.categoria c where c.nombre = coalesce(cand.cat, 'Sin categoría'))
    from candidatos cand
   where cand.id = p.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- 5b. Pago conjunto: reparte el coste entre TODOS los campos según su tamaño (método del resto mayor, en céntimos)
drop function if exists public.pago_conjunto(timestamp, text, text, numeric, int, int);
create or replace function public.pago_conjunto(
  p_fecha timestamp, p_nombre text, p_descripcion text, p_coste numeric,
  p_anio int default null, p_categoria_id int default null, p_pagado boolean default true
) returns setof public.pago
language plpgsql as $$
declare
  v_cents bigint;
  v_total numeric;
begin
  if p_coste is null or p_coste <= 0 then raise exception 'El coste total del pago conjunto debe ser mayor que 0.'; end if;
  if p_nombre is null or length(btrim(p_nombre)) = 0 then raise exception 'El nombre es obligatorio.'; end if;
  if p_fecha is null then raise exception 'La fecha es obligatoria.'; end if;

  v_cents := round(p_coste * 100)::bigint;
  select coalesce(sum(tamano), 0) into v_total from public.campo where tamano > 0;
  if v_total <= 0 then raise exception 'No hay campos con tamaño para repartir el pago conjunto.'; end if;

  return query
  with calc as (
    select id,
           floor(v_cents * tamano / v_total)::bigint as base,
           (v_cents * tamano / v_total) - floor(v_cents * tamano / v_total) as resto
    from public.campo where tamano > 0
  ),
  ranked as (
    select id, base, row_number() over (order by resto desc, id) as rn from calc
  ),
  pend as (select v_cents - sum(base) as n from calc),
  ins as (
    insert into public.pago (fecha, nombre, descripcion, coste, anio, "campoId", "categoriaId", pagado)
    select p_fecha, btrim(p_nombre), coalesce(p_descripcion, ''),
           (r.base + case when r.rn <= (select n from pend) then 1 else 0 end)::numeric / 100,
           p_anio, r.id, p_categoria_id, coalesce(p_pagado, true)
    from ranked r
    returning *
  )
  select * from ins;
end $$;

-- 5c. Eliminar una categoría decidiendo qué pasa con sus pagos: 'sin' | 'mover' | 'eliminar'
create or replace function public.eliminar_categoria(p_id int, p_accion text default 'sin', p_destino int default null)
returns json
language plpgsql as $$
declare
  v_nombre text;
  v_destino int;
  v_n int := 0;
begin
  if p_accion not in ('sin', 'mover', 'eliminar') then raise exception 'Acción no válida (sin, mover o eliminar).'; end if;

  select nombre into v_nombre from public.categoria where id = p_id;
  if v_nombre is null then raise exception 'Categoría no encontrada.'; end if;
  if v_nombre = 'Sin categoría' then raise exception 'La categoría «Sin categoría» no se puede eliminar.'; end if;

  if p_accion = 'mover' then
    if p_destino is null or p_destino = p_id then raise exception 'La categoría de destino debe ser distinta.'; end if;
    if not exists (select 1 from public.categoria where id = p_destino) then raise exception 'La categoría de destino no existe.'; end if;
    v_destino := p_destino;
  elsif p_accion = 'sin' then
    select id into v_destino from public.categoria where nombre = 'Sin categoría';
  end if;

  if p_accion = 'eliminar' then
    delete from public.pago where "categoriaId" = p_id;
    get diagnostics v_n = row_count;
  else
    update public.pago set "categoriaId" = v_destino where "categoriaId" = p_id;
    get diagnostics v_n = row_count;
  end if;

  delete from public.categoria where id = p_id;
  return json_build_object('id', p_id, 'nombre', v_nombre, 'accion', p_accion, 'pagosAfectados', v_n);
end $$;

revoke execute on function public.categorizar_pagos(), public.eliminar_categoria(int, text, int),
  public.pago_conjunto(timestamp, text, text, numeric, int, int, boolean) from public, anon;
grant execute on function public.categorizar_pagos(), public.eliminar_categoria(int, text, int),
  public.pago_conjunto(timestamp, text, text, numeric, int, int, boolean) to authenticated;

-- 6. Clasifica los pagos ya existentes
select public.categorizar_pagos();
