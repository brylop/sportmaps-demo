import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { paymentRemindersAPI } from '@/lib/api/payment-reminders';
import { daysDiffFromToday } from '@/lib/dateUtils';
import { FailedAttemptChip } from '@/components/payment/FailedAttemptChip';
import { StatFilterBar } from '@/components/common/StatFilterBar';
import { TableRefreshBar } from '@/components/common/TableRefreshBar';
import { isOverdueCharge, type ChargeState } from '@/lib/paymentCartera';

/** Una fila embebida de PostgREST llega como objeto o como array de un elemento. */
const embedded = <T,>(v: unknown): T | null =>
  (Array.isArray(v) ? (v[0] as T | undefined) : (v as T | null)) ?? null;

/** Un texto en blanco de la base vale lo mismo que un NULL. */
const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
};

/**
 * Quién figura como pagador. `account` y `self` ya tienen usuario en la app;
 * `temp` y `unregistered` son contactos que cargó la escuela y todavía no se
 * registraron — esa familia no puede pagar en línea, hay que llamarla.
 */
type PayerSource = 'account' | 'self' | 'temp' | 'unregistered' | 'none';

/** Lo que hace falta de un cobro para ponerle cara: los cuatro caminos posibles. */
type PayableRow = ChargeState & {
  id: string;
  concept: string;
  amount: number | string;
  last_failure_at?: string | null;
  last_failure_reason?: string | null;
  requires_review?: boolean | null;
  student?: unknown;       // children
  parent?: unknown;        // profiles vía parent_id
  athlete?: unknown;       // profiles vía user_id — atleta adulto, se paga solo
  unregistered?: unknown;  // unregistered_athletes — cargado por la escuela
};

type PersonRef = { full_name?: string | null; phone?: string | null };
type ChildRef = { full_name?: string | null; parent_name_temp?: string | null; parent_phone_temp?: string | null };

/**
 * El acudiente NO siempre está en `payments.parent_id`: ese campo se llena solo
 * cuando la familia creó su cuenta. La escuela igual cargó el contacto y quedó en
 * `children.parent_*_temp`, y los atletas adultos se pagan a sí mismos. Mirando
 * únicamente `parent_id`, 131 de las 221 filas vencidas de Dynasty salían como
 * "Desconocido" con el nombre y el celular sentados en la base — y sin nombre no
 * hay a quién cobrarle.
 */
const resolvePayer = (p: PayableRow): { name: string | null; phone: string | null; source: PayerSource } => {
  const child = embedded<ChildRef>(p.student);
  const account = embedded<PersonRef>(p.parent);
  const adult = embedded<PersonRef>(p.athlete);
  const unreg = embedded<PersonRef>(p.unregistered);

  const fromAccount = clean(account?.full_name);
  if (fromAccount) return { name: fromAccount, phone: clean(account?.phone), source: 'account' };

  const fromTemp = clean(child?.parent_name_temp);
  if (fromTemp) return { name: fromTemp, phone: clean(child?.parent_phone_temp), source: 'temp' };

  const fromAdult = clean(adult?.full_name);
  if (fromAdult) return { name: fromAdult, phone: clean(adult?.phone), source: 'self' };

  const fromUnreg = clean(unreg?.full_name);
  if (fromUnreg) return { name: fromUnreg, phone: clean(unreg?.phone), source: 'unregistered' };

  return { name: null, phone: null, source: 'none' };
};

/**
 * El atleta tampoco está siempre en `children`: si es adulto va por `user_id`, y
 * si la escuela lo cargó sin invitarlo, por `unregistered_athlete_id`.
 */
const resolveAthleteName = (p: PayableRow): string | null =>
  clean(embedded<ChildRef>(p.student)?.full_name)
  ?? clean(embedded<PersonRef>(p.athlete)?.full_name)
  ?? clean(embedded<PersonRef>(p.unregistered)?.full_name);

interface OverdueAccount {
  id: string;
  parent: string;
  /** De dónde salió el nombre del pagador; manda si se le marca "sin cuenta". */
  payerSource: PayerSource;
  /** El celular que la escuela tiene para cobrarle, venga de donde venga. */
  parentPhone: string | null;
  student: string;
  concept: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  status: 'overdue' | 'reminder_sent';
  lastContactDate?: string;
  /**
   * Último intento de pago que se cayó. Cambia la conversación de cobro: no es
   * lo mismo una familia que no hizo nada que una a la que el banco le tumbó
   * el débito — a esa hay que decirle que pruebe con otro medio.
   */
  lastFailureAt?: string | null;
  lastFailureReason?: string | null;
  /** ERROR/VOIDED sin resolver: no sabemos si el dinero se movió. */
  requiresReview?: boolean;
}

/**
 * Cómo se agrupa la cartera por lo que pasó con el último intento de pago.
 *
 * No es lo mismo una familia que no hizo nada que una a la que el banco le
 * tumbó el débito: a la primera se le cobra, a la segunda se le explica. Y los
 * ambiguos no se cobran hasta verificar, porque quizá ya pagaron.
 */
type AttemptFilter = 'all' | 'rejected' | 'review' | 'none';

/** La cartera de Dynasty son 221 filas: sin paginar, la pantalla es una sábana. */
const OVERDUE_PAGE_SIZE = 25;

interface OverdueAccountsCardProps {
  payments: PayableRow[] | undefined;
  schoolId: string | null | undefined;
  schoolName: string | null | undefined;
  /** El fetch de `payments` vive en el shell (se comparte con KPIs y Transacciones). */
  onRefresh: () => void;
  refreshing: boolean;
}

/** Contenido del tab "Cartera": cuentas por cobrar, por COBRO (no por atleta). */
export function OverdueAccountsCard({ payments, schoolId, schoolName, onRefresh, refreshing }: OverdueAccountsCardProps) {
  const { toast } = useToast();

  // Paginación de la cartera. Se reinicia al cambiar de escuela o sede: la página
  // 7 de otra sede no significa nada acá.
  const [odPage, setOdPage] = useState(1);
  useEffect(() => { setOdPage(1); }, [schoolId]);

  const accountsData = payments?.filter(isOverdueCharge) || [];
  const [overdueAccounts, setOverdueAccounts] = useState<OverdueAccount[]>([]);

  useEffect(() => {
    if (accountsData) {
      setOverdueAccounts(accountsData.map(p => {
        const payer = resolvePayer(p);
        return {
          id: p.id,
          parent: payer.name || 'Desconocido',
          payerSource: payer.source,
          parentPhone: payer.phone,
          student: resolveAthleteName(p) || 'Deportista',
          concept: p.concept,
          amount: Number(p.amount),
          dueDate: p.due_date,
          daysOverdue: daysDiffFromToday(p.due_date),
          status: 'overdue' as const,
          lastFailureAt: p.last_failure_at ?? null,
          lastFailureReason: p.last_failure_reason ?? null,
          requiresReview: p.requires_review === true,
        };
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments]);

  // ── Filtro por lo que pasó con el último intento de pago ───────────────────
  const [attemptFilter, setAttemptFilter] = useState<AttemptFilter>('all');

  const attemptCounts = useMemo(() => {
    let rejected = 0, review = 0, none = 0;
    for (const a of overdueAccounts) {
      if (a.requiresReview) review += 1;
      else if (a.lastFailureReason) rejected += 1;
      else none += 1;
    }
    return { rejected, review, none };
  }, [overdueAccounts]);

  const filteredOverdue = useMemo(() => {
    switch (attemptFilter) {
      case 'rejected': return overdueAccounts.filter(a => a.lastFailureReason && !a.requiresReview);
      case 'review':   return overdueAccounts.filter(a => a.requiresReview);
      case 'none':     return overdueAccounts.filter(a => !a.lastFailureReason && !a.requiresReview);
      default:         return overdueAccounts;
    }
  }, [overdueAccounts, attemptFilter]);

  // Cambiar de filtro con la página 3 abierta dejaba la tabla vacía sin motivo.
  useEffect(() => { setOdPage(1); }, [attemptFilter]);

  // Si la cartera se encoge (alguien pagó, o se cambió de sede) la página en la que
  // estaba parado el usuario puede ya no existir: se acota en vez de mostrar una
  // tabla vacía sin explicación.
  const odTotalPages = Math.max(1, Math.ceil(filteredOverdue.length / OVERDUE_PAGE_SIZE));
  const odCurrentPage = Math.min(odPage, odTotalPages);
  const pagedOverdue = filteredOverdue.slice(
    (odCurrentPage - 1) * OVERDUE_PAGE_SIZE,
    odCurrentPage * OVERDUE_PAGE_SIZE,
  );

  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  /**
   * Antes: un `setTimeout` de 1,5 s y un toast que anunciaba "Recordatorio WhatsApp
   * enviado" sin mandar nada, con el historial en memoria — se perdía al recargar.
   * Le afirmaba a la escuela que había cobrado cuando no había cobrado.
   */
  const handleSendReminder = async (accountId: string) => {
    const account = overdueAccounts.find(a => a.id === accountId);
    if (!account || !schoolId) return;

    setSendingReminder(accountId);
    try {
      const result = await paymentRemindersAPI.sendWhatsAppReminder(
        {
          paymentId: account.id,
          contactName: account.parent,
          contactPhone: account.parentPhone,
          athleteName: account.student,
          amount: account.amount,
          dueDate: account.dueDate,
          status: 'overdue',
        },
        { schoolId, schoolName },
      );

      if (result.status === 'no_phone') {
        toast({
          variant: 'destructive',
          title: 'Sin teléfono para cobrar',
          description: `No hay celular registrado para ${account.parent}. Agrégalo en la ficha de ${account.student}.`,
        });
        return;
      }

      if (result.status === 'invalid_phone') {
        toast({
          variant: 'destructive',
          title: 'El teléfono no es marcable',
          description: `«${result.phone}» no es un celular válido. Corrígelo en la ficha de ${account.student} y vuelve a intentar.`,
        });
        return;
      }

      // La fila se marca solo cuando WhatsApp se abrió de verdad.
      setOverdueAccounts(prev => prev.map(a =>
        a.id === accountId
          ? { ...a, status: 'reminder_sent' as const, lastContactDate: new Date().toISOString() }
          : a
      ));

      toast({
        title: 'WhatsApp abierto',
        description: `Revisa el mensaje para ${account.parent} y dale enviar${result.usedFallback ? ' (se usó el texto por defecto: la plantilla no respondió)' : ''}.`,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo preparar el recordatorio',
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
      });
    } finally {
      setSendingReminder(null);
    }
  };

  const getStatusBadge = (account: OverdueAccount) => {
    if (account.status === 'reminder_sent') {
      return (
        <div className="flex flex-col gap-1">
          <Badge className="bg-yellow-500 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Recordatorio Enviado
          </Badge>
          {account.lastContactDate && (
            <span className="text-xs text-muted-foreground">
              Último: {new Date(account.lastContactDate).toLocaleDateString('es-CO')}
            </span>
          )}
        </div>
      );
    }
    return <Badge variant="destructive">{account.daysOverdue} días vencido</Badge>;
  };

  return (
    <>
      {/* Separar la cartera por lo que pasó con el último intento. «Sin
          intento» es la mora clásica; «Pago rechazado» es una familia que
          SÍ trató de pagar — a esa se le escribe distinto. «Verificar en
          pasarela» no se cobra hasta saber si el dinero se movió. */}
      <div className="mb-4">
        <StatFilterBar
          columns={4}
          value={attemptFilter === 'all' ? null : attemptFilter}
          onChange={(v) => setAttemptFilter((v as AttemptFilter) ?? 'all')}
          items={[
            { key: null, label: 'Todas', value: overdueAccounts.length, tone: 'neutral' },
            { key: 'rejected', label: 'Pago rechazado', value: attemptCounts.rejected, tone: 'yellow' },
            {
              key: 'review',
              label: 'Verificar en pasarela',
              value: attemptCounts.review,
              tone: 'orange',
              hidden: attemptCounts.review === 0 && attemptFilter !== 'review',
            },
            { key: 'none', label: 'Sin intento', value: attemptCounts.none, tone: 'rose' },
          ]}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Acudiente / Pagador</TableHead>
            <TableHead>Deportista</TableHead>
            <TableHead>Concepto</TableHead>
            <TableHead>Monto Vencido</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Sin esto, filtrar por «Verificar en pasarela» sin resultados
              dejaba la tabla en blanco y se leía como que se cayó la carga. */}
          {pagedOverdue.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                {attemptFilter === 'all'
                  ? 'No hay cuentas por cobrar.'
                  : 'Ninguna cuenta por cobrar cae en este filtro.'}
              </TableCell>
            </TableRow>
          )}
          {pagedOverdue.map((account) => (
            <TableRow key={account.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-0.5">
                  <span>{account.parent}</span>
                  {(account.payerSource === 'temp' || account.payerSource === 'unregistered') && (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
                      <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal">
                        sin cuenta
                      </Badge>
                      {account.parentPhone}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>{account.student}</TableCell>
              <TableCell>{account.concept}</TableCell>
              <TableCell className="text-red-500 font-bold">
                ${account.amount.toLocaleString()}
              </TableCell>
              <TableCell>
                {getStatusBadge(account)}
                {(account.lastFailureReason || account.requiresReview) && (
                  <span className="block mt-1">
                    <FailedAttemptChip
                      reason={account.lastFailureReason}
                      at={account.lastFailureAt}
                      requiresReview={account.requiresReview}
                      showReason
                    />
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant={account.status === 'reminder_sent' ? 'ghost' : 'outline'}
                  onClick={() => handleSendReminder(account.id)}
                  disabled={sendingReminder === account.id}
                  className={account.status === 'reminder_sent' ? 'text-green-600' : ''}
                >
                  {sendingReminder === account.id ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Enviando...
                    </>
                  ) : account.status === 'reminder_sent' ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Reenviar
                    </>
                  ) : (
                    <>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Enviar WhatsApp
                    </>
                  )}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TableRefreshBar
        className="-mx-6 -mb-6 mt-2 rounded-b-lg"
        onRefresh={onRefresh}
        loading={refreshing}
        summary={
          // Con un filtro activo el total tiene que ser el de lo FILTRADO,
          // y el monto también: mostrar «$52M» debajo de 6 filas de $910k
          // se lee como que el filtro no hizo nada.
          `${filteredOverdue.length} cuenta(s) por cobrar` +
          (attemptFilter === 'all' ? '' : ` de ${overdueAccounts.length}`) +
          ` · $${filteredOverdue.reduce((s, a) => s + a.amount, 0).toLocaleString('es-CO')}` +
          (odTotalPages > 1 ? ` · página ${odCurrentPage} de ${odTotalPages}` : '')
        }
      >
        {odTotalPages > 1 && (
          <>
            <Button variant="outline" size="sm" disabled={odCurrentPage <= 1}
              onClick={() => setOdPage(odCurrentPage - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={odCurrentPage >= odTotalPages}
              onClick={() => setOdPage(odCurrentPage + 1)}>Siguiente</Button>
          </>
        )}
      </TableRefreshBar>
    </>
  );
}
