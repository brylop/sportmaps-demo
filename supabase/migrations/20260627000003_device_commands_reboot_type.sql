-- ════════════════════════════════════════════════════════════════════════════
-- device_commands: permitir command_type = 'reboot'
-- ════════════════════════════════════════════════════════════════════════════
-- El handler /iclock/getrequest ahora soporta enviar `C:<seq>:REBOOT` al F22
-- (commit 2f9be72) para forzar el re-handshake del lector y que reciba el Stamp
-- dinámico (dad8809). El CHECK constraint de command_type no incluía 'reboot',
-- así que el INSERT del comando fallaba (23514).
--
-- Idempotente: drop + add. No afecta filas existentes (todos los tipos previos
-- siguen permitidos).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.device_commands
  DROP CONSTRAINT IF EXISTS device_commands_command_type_check;

ALTER TABLE public.device_commands
  ADD CONSTRAINT device_commands_command_type_check
  CHECK (command_type IN (
    'enroll_user',
    'delete_user',
    'disable_user',
    'enable_user',
    'open_door',
    'reboot'
  ));

NOTIFY pgrst, 'reload schema';
