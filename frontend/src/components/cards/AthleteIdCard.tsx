import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ShieldCheck, AlertTriangle, XCircle, CalendarDays, Hash, MapPin, Users, Heart, Phone, Shirt, User } from 'lucide-react';

export type CardData = {
  found: boolean;
  status: 'active' | 'revoked' | 'expired' | string;
  card_id?: string;
  qr_token?: string;
  issued_at?: string;
  valid_until?: string;
  version?: number;
  school?: {
    id: string;
    name: string;
    slug?: string | null;
    logo_url?: string | null;
    branding_settings?: any;
  };
  template?: {
    id: string;
    name: string;
    accent_color?: string | null;
    header_text?: string | null;
    footer_text?: string | null;
    show_fields?: Record<string, boolean>;
  } | null;
  athlete?: {
    kind: 'child' | 'profile';
    full_name: string;
    avatar_url?: string | null;
    doc_type?: string | null;
    doc_number?: string | null;
    date_of_birth?: string | null;
    blood_type?: string | null;
    eps_name?: string | null;
    tshirt_size?: string | null;
    emergency_contact?: string | null;
    gender?: string | null;
    role?: string | null;
  };
  branch_name?: string | null;
  team_name?: string | null;
  monthly_fee?: number | null;
  fee_status?: 'paid' | 'due_soon' | 'overdue' | 'no_payments' | 'unknown';
  last_paid_at?: string | null;
  next_due?: string | null;
  revoked_at?: string;
  reason?: string;
};

const FEE_BADGE: Record<string, { label: string; bg: string; fg: string; icon: typeof ShieldCheck }> = {
  paid:        { label: 'Cuota al día',       bg: '#16a34a', fg: '#ffffff', icon: ShieldCheck },
  due_soon:    { label: 'Próxima a vencer',   bg: '#eab308', fg: '#1f2937', icon: AlertTriangle },
  overdue:     { label: 'Cuota vencida',      bg: '#dc2626', fg: '#ffffff', icon: XCircle },
  no_payments: { label: 'Sin pagos',          bg: '#6b7280', fg: '#ffffff', icon: AlertTriangle },
  unknown:     { label: 'Estado desconocido', bg: '#6b7280', fg: '#ffffff', icon: AlertTriangle },
};

interface Props {
  data: CardData;
  publicUrl: string;
  className?: string;
}

export const AthleteIdCard = forwardRef<HTMLDivElement, Props>(({ data, publicUrl, className = '' }, ref) => {
  const branding = data.school?.branding_settings || {};
  const primaryColor: string = data.template?.accent_color || branding.primary_color || '#0ea5e9';
  const secondaryColor: string = branding.secondary_color || '#1e40af';
  const showWatermark: boolean = branding.show_sportmaps_watermark !== false;
  const show = data.template?.show_fields || {
    photo: true, doc_number: true, team: true, branch: true, plan: true,
    valid_until: true, fee_status: true, blood_type: false,
    emergency_contact: false, eps: false, tshirt_size: false,
  };

  const feeKey = data.fee_status || 'unknown';
  const feeBadge = FEE_BADGE[feeKey] || FEE_BADGE.unknown;
  const FeeIcon = feeBadge.icon;

  const isInactive = data.status === 'revoked' || data.status === 'expired';

  return (
    <div
      ref={ref}
      className={`relative w-[340px] h-[540px] rounded-2xl overflow-hidden shadow-2xl ${className}`}
      style={{
        background: `linear-gradient(160deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
      }}
    >
      {/* Banda lateral derecha decorativa */}
      <div
        className="absolute top-0 right-0 w-1/3 h-full opacity-15"
        style={{
          background: `repeating-linear-gradient(45deg, ${primaryColor}, ${primaryColor} 10px, transparent 10px, transparent 20px)`,
        }}
      />

      {/* Header */}
      <div className="relative px-5 pt-5 pb-3 flex items-center gap-3 border-b border-white/20">
        {data.school?.logo_url ? (
          <img
            src={data.school.logo_url}
            alt=""
            className="h-12 w-12 rounded-lg bg-white/95 object-contain p-1"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="h-12 w-12 rounded-lg bg-white/95 flex items-center justify-center text-xl font-bold" style={{ color: primaryColor }}>
            {data.school?.name?.[0] || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/70 font-medium">
            {data.template?.header_text || 'Carnet deportivo'}
          </p>
          <h3 className="text-white font-bold text-base leading-tight truncate">
            {data.school?.name}
          </h3>
        </div>
      </div>

      {/* Foto + nombre */}
      <div className="relative px-5 pt-4 flex flex-col items-center text-center">
        {show.photo && (
          <div className="mb-3 rounded-2xl overflow-hidden ring-4 ring-white/40 bg-white/95" style={{ width: 110, height: 110 }}>
            {data.athlete?.avatar_url ? (
              <img src={data.athlete.avatar_url} alt={data.athlete.full_name} className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <User className="h-12 w-12" />
              </div>
            )}
          </div>
        )}

        <p className="text-white font-bold text-lg leading-tight max-w-full break-words">
          {data.athlete?.full_name || '—'}
        </p>

        {show.doc_number && data.athlete?.doc_number && (
          <p className="text-white/85 text-xs mt-0.5 flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {data.athlete.doc_type || 'CC'} {data.athlete.doc_number}
          </p>
        )}
      </div>

      {/* Datos */}
      <div className="relative px-5 mt-3 space-y-1.5">
        {show.branch && data.branch_name && (
          <Row icon={MapPin} label="Sede" value={data.branch_name} />
        )}
        {show.team && data.team_name && (
          <Row icon={Users} label="Equipo" value={data.team_name} />
        )}
        {show.blood_type && data.athlete?.blood_type && (
          <Row icon={Heart} label="RH" value={data.athlete.blood_type} />
        )}
        {show.eps && data.athlete?.eps_name && (
          <Row icon={Heart} label="EPS" value={data.athlete.eps_name} />
        )}
        {show.tshirt_size && data.athlete?.tshirt_size && (
          <Row icon={Shirt} label="Talla" value={data.athlete.tshirt_size} />
        )}
        {show.emergency_contact && data.athlete?.emergency_contact && (
          <Row icon={Phone} label="Emergencia" value={data.athlete.emergency_contact} />
        )}
      </div>

      {/* Bottom: QR + estado */}
      <div className="absolute left-0 right-0 bottom-0 px-5 pb-4 pt-3 bg-black/15 backdrop-blur-[1px]">
        <div className="flex items-center justify-between gap-3">
          <div className="bg-white p-1.5 rounded-lg">
            <QRCodeSVG value={publicUrl} size={72} level="M" />
          </div>
          <div className="flex-1 text-right">
            {show.fee_status && (
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1"
                style={{ backgroundColor: feeBadge.bg, color: feeBadge.fg }}
              >
                <FeeIcon className="h-3 w-3" />
                {feeBadge.label}
              </div>
            )}
            {show.valid_until && data.valid_until && (
              <p className="text-white/85 text-[11px] flex items-center justify-end gap-1">
                <CalendarDays className="h-3 w-3" />
                Vence {new Date(data.valid_until).toLocaleDateString('es-CO')}
              </p>
            )}
            {data.version && data.version > 1 && (
              <p className="text-white/60 text-[10px] mt-0.5">v{data.version}</p>
            )}
          </div>
        </div>

        {data.template?.footer_text && (
          <p className="text-[9px] text-white/60 text-center mt-2 leading-tight">
            {data.template.footer_text}
          </p>
        )}
      </div>

      {/* Watermark SportMaps si la escuela no es paid-tier */}
      {showWatermark && (
        <div className="absolute bottom-1 right-2 text-[8px] text-white/40 select-none">
          SportMaps
        </div>
      )}

      {/* Overlay si revocado/expirado */}
      {isInactive && (
        <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center z-10">
          <XCircle className="h-12 w-12 text-red-400 mb-2" />
          <p className="text-white font-bold uppercase tracking-wider">
            {data.status === 'revoked' ? 'Carnet revocado' : 'Carnet vencido'}
          </p>
          {data.reason && <p className="text-white/80 text-xs mt-1 px-6 text-center">{data.reason}</p>}
        </div>
      )}
    </div>
  );
});

AthleteIdCard.displayName = 'AthleteIdCard';

function Row({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-white">
      <div className="bg-white/20 p-1 rounded">
        <Icon className="h-3 w-3" />
      </div>
      <span className="text-[10px] uppercase tracking-wider text-white/70 w-16">{label}</span>
      <span className="text-xs font-medium truncate flex-1">{value}</span>
    </div>
  );
}
