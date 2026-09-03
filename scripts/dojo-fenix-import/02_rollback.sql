-- Rollback de la carga inicial de Dojo Fénix (school_id 26bfb68e-87d4-4792-a1bb-3c65ef5358ce)
-- corrida el 2026-09-02. Borra SOLO lo que este import creó, en orden inverso
-- de dependencias. Los 3 usuarios adultos (auth.users) NO se borran acá porque
-- ya recibieron el correo de invitación y podrían haber iniciado sesión — si
-- hay que borrarlos también, usar auth.admin.deleteUser desde un script aparte
-- después de confirmar que no entraron.

begin;

delete from public.payments
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and period_year = 2026 and period_month = 9
  and id in (
    '8d18d9b3-d706-4242-9912-9a2646fcd6d2','e4eeb7e4-0ce5-4163-b3eb-7c71ed5b1c6f',
    '3a833796-9581-4873-aff4-39dc9eeebad6','4381eca3-a3e8-4659-bc7e-902da965af82',
    '623998d5-6341-46f4-b2e0-5aa640957a06','d4c5825d-c727-4637-83d8-1403d973df69',
    '3bae38ad-ad9b-4cf1-aada-5ca6f7f06648','f3ad3056-fd7c-495b-beca-0ce88618e7cf',
    'e168e80e-ea7b-41f0-a2a3-04a8197e3d9f','4385c91f-f103-4a2a-9a4c-331fff7e93ea',
    'bfb86fbb-f7bd-4901-bc45-75a0d7bfe704',
    '9de8ed0b-e5ce-4589-8ed9-a341348f298b','32dbc211-2474-4507-9243-df4167fe641c',
    '4d562245-2a52-4373-8a64-206e9db21424'
  );

delete from public.enrollment_categories
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and enrollment_id in (
    '1f18cdca-086a-4892-a960-297a69fc8f14','bcff08f5-034b-4073-95cf-31491366033f',
    '97979001-5459-4864-a357-81cd70872c4f','4137b085-751f-4b76-b964-762a0fb9168d',
    '303dc9c8-77e8-4cff-bbb1-0e07fa9bc5ea','2ab94b73-acd5-400c-bd16-03619f4a7c5e',
    'bed520b4-13a2-467c-99eb-df2497c85d68','57d2fc6e-e4a5-4e12-903d-22848df07f1a',
    '19b9e0ab-dd4f-4ba6-a016-4d40c285bc76','445ea8de-8e92-43c3-8cab-181fd4994899',
    '3c718780-a255-4b37-b2fe-9dba9996c4d6',
    '6e458e83-54d4-4fb3-97cb-d393bd5e41f7','c0748d7d-eb34-4cf9-a338-af578125f6f6',
    '68395a04-0f9b-4f70-81d3-445e9d76f0ea'
  );

delete from public.enrollments
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and id in (
    '1f18cdca-086a-4892-a960-297a69fc8f14','bcff08f5-034b-4073-95cf-31491366033f',
    '97979001-5459-4864-a357-81cd70872c4f','4137b085-751f-4b76-b964-762a0fb9168d',
    '303dc9c8-77e8-4cff-bbb1-0e07fa9bc5ea','2ab94b73-acd5-400c-bd16-03619f4a7c5e',
    'bed520b4-13a2-467c-99eb-df2497c85d68','57d2fc6e-e4a5-4e12-903d-22848df07f1a',
    '19b9e0ab-dd4f-4ba6-a016-4d40c285bc76','445ea8de-8e92-43c3-8cab-181fd4994899',
    '3c718780-a255-4b37-b2fe-9dba9996c4d6',
    '6e458e83-54d4-4fb3-97cb-d393bd5e41f7','c0748d7d-eb34-4cf9-a338-af578125f6f6',
    '68395a04-0f9b-4f70-81d3-445e9d76f0ea'
  );

-- Menores (children)
delete from public.children
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and id in (
    '7e22d777-108d-400e-83a4-6713214551ee','c38387b5-34b9-421f-ae3d-ad0bb82b2345',
    'f53e2d9a-b813-4d48-9e49-7de3b8370675','d609de83-fa1c-471a-a384-6835fbec8eb8',
    'af038612-265a-4c14-9351-50f000c5fea2','3a249712-da17-4756-9cc8-066284d3eff8',
    'e551dac0-4c87-4158-a86b-99ecbfb5cc80','e66c93d5-d76f-4542-841d-8decf2b60dec',
    'ea63e10e-5c63-48be-a6b4-f078acf72a32','b712b071-f148-4442-8897-2e787097f15b',
    '072da743-8d0e-4f1f-89da-80c77eee32ca'
  );

-- school_members de los 3 adultos (los perfiles/auth.users se dejan, ver nota arriba)
delete from public.school_members
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and id in (
    '9561ad7e-8d4b-47b3-8ebe-2d8961c06c7d','26d8d328-e89c-4c0e-88a8-af8053682928',
    '073ee56d-4112-4920-9532-5120b248be90'
  );

-- Categorías de cinturón (solo si nadie más quedó apuntando a ellas)
delete from public.school_categories
where school_id = '26bfb68e-87d4-4792-a1bb-3c65ef5358ce'
  and code in ('blanco','azul','azul_fn','naranja','naranja_fn','verde','verde_fn')
  and not exists (
    select 1 from public.enrollment_categories ec2 where ec2.category_id = school_categories.id
  );

commit;
