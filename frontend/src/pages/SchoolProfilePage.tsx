import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSchoolDetail } from "@/hooks/useExplorar";
import { useFavoritos } from "@/hooks/useFavoritos";
import { SchoolMap } from "@/components/SchoolMap";
import type { SchoolDetail, Team, Offering, Review } from "@/types/school.types";

// ─── utils ───────────────────────────────────────────────────────────────────

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const SPORT_COLORS: Record<string, string> = {
  "Fútbol": "#22c55e", "Baloncesto": "#f97316", "Natación": "#0ea5e9",
  "Cheerleading": "#ec4899", "Porras": "#a855f7", "Gimnasia": "#eab308",
  "Artes Marciales": "#ef4444", "Tenis": "#84cc16", "Voleibol": "#06b6d4",
  "Béisbol": "#f59e0b", "Atletismo": "#10b981", "MMA": "#dc2626",
  "Multideporte": "#64748b",
};

function cop(n: number | null) {
  if (!n) return null;
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
function timeShort(t: string) { return t?.slice(0, 5) ?? ""; }
function accentFor(s: SchoolDetail) {
  const sport = s.sports?.[0] ?? s.team_sports?.[0];
  return (sport && SPORT_COLORS[sport]) || s.branding_settings?.primary_color || "#6366f1";
}

/**
 * URL para "Cómo llegar" usando OpenStreetMap.
 * En móvil el navegador abre la app nativa de mapas (iOS/Android).
 * Si hay coords exactas las usa; si no, busca por dirección de texto.
 */
function buildDirectionsUrl(school: SchoolDetail): string {
  const main = (school.branches ?? []).find(b => b.is_main) ?? school.branches?.[0];

  // Con coordenadas: abre OpenStreetMap directions (redirige a app nativa en móvil)
  if (main?.lat && main?.lng) {
    return `https://www.openstreetmap.org/directions?to=${main.lat},${main.lng}#map=16/${main.lat}/${main.lng}`;
  }

  // Solo dirección de texto: búsqueda en OSM
  const query = [main?.address, main?.city ?? school.city, "Colombia"].filter(Boolean).join(", ");
  if (query) {
    return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
  }

  // Fallback: nombre de la escuela
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent([school.name, school.city].filter(Boolean).join(" "))}`;
}

// ─── Compartir hook ───────────────────────────────────────────────────────────

function useShare(school: SchoolDetail | null) {
  const [copied, setCopied] = useState(false);
  const share = useCallback(async () => {
    if (!school) return;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: school.name, text: `Mira ${school.name} en SportMaps`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [school]);
  return { share, copied };
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ w = "100%", h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#1e293b 25%,#253347 50%,#1e293b 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />;
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const r = Math.round(rating);
  return <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: -1 }}>{"★".repeat(r)}{"☆".repeat(5 - r)}</span>;
}

function RatingBars({ dist, total }: { dist: Record<string, number>; total: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {[5, 4, 3, 2, 1].map(n => {
        const count = dist[String(n)] ?? 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#94a3b8", width: 10 }}>{n}</span>
            <span style={{ color: "#f59e0b", fontSize: 12 }}>★</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, background: "#f59e0b", width: `${pct}%`, transition: "width 0.8s ease" }} />
            </div>
            <span style={{ fontSize: 11, color: "#64748b", width: 24, textAlign: "right" }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: "programas",     label: "Programas",    icon: "🎯" },
  { key: "planes",        label: "Planes",       icon: "💳" },
  { key: "instalaciones", label: "Instalaciones",icon: "🏟️" },
  { key: "sedes",         label: "Sedes y Mapa", icon: "📍" },
  { key: "opiniones",     label: "Opiniones",    icon: "⭐" },
];

function TabNav({ active, onChange, accent }: { active: string; onChange: (t: string) => void; accent: string }) {
  return (
    <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: "8px 16px", borderRadius: 24, border: "none", fontFamily: "inherit",
          fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
          background: active === t.key ? accent : "#1e293b",
          color: active === t.key ? "#fff" : "#94a3b8",
          transition: "all 0.2s",
          boxShadow: active === t.key ? `0 4px 14px ${accent}55` : "none",
        }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgramCard({ program, accent }: { program: Team; accent: string }) {
  const [open, setOpen] = useState(false);
  const byDay = (program.classes ?? []).reduce((acc, c) => {
    if (!acc[c.day_of_week]) acc[c.day_of_week] = [];
    acc[c.day_of_week].push(c);
    return acc;
  }, {} as Record<number, typeof program.classes>);

  return (
    <div style={{ background: "#0f172a", border: `1px solid ${open ? accent : "#1e293b"}`, borderRadius: 14, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: 16, cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
        {program.image_url
          ? <img src={program.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
          : <div style={{ width: 56, height: 56, borderRadius: 10, background: `${accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🎯</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>{program.name}</h4>
            <span style={{ fontSize: 18, color: "#475569", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {program.level && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${accent}18`, color: accent, border: `1px solid ${accent}44` }}>{program.level}</span>}
            {program.age_min != null && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#1e293b", color: "#94a3b8" }}>👶 {program.age_min}–{program.age_max} años</span>}
            {program.price_monthly && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "#1e293b", color: "#22c55e" }}>{cop(program.price_monthly)}/mes</span>}
          </div>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1e293b" }}>
          {program.description && <p style={{ margin: "12px 0", fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{program.description}</p>}
          {Object.keys(byDay).length > 0 && (
            <>
              <p style={{ margin: "12px 0 8px", fontSize: 12, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Horarios</p>
              {Object.entries(byDay).map(([day, slots]) => (
                <div key={day} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", width: 30 }}>{DAYS[Number(day)]}</span>
                  {(slots ?? []).map(s => (
                    <span key={s!.id} style={{ fontSize: 11, padding: "2px 10px", borderRadius: 20, background: `${accent}18`, color: accent }}>
                      {timeShort(s!.start_time)} – {timeShort(s!.end_time)}
                    </span>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function OfferingCard({ offering, accent }: { offering: Offering; accent: string }) {
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 16 }}>
      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{offering.name}</h4>
      {offering.description && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>{offering.description}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {(offering.plans ?? []).map(plan => (
          <div key={plan.id} style={{ background: "#0a1628", border: `1px solid ${accent}33`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{plan.name}</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: accent }}>{cop(plan.price)}</span>
            {plan.max_sessions && <span style={{ fontSize: 11, color: "#64748b" }}>{plan.max_sessions} sesiones</span>}
            {plan.duration_days && <span style={{ fontSize: 11, color: "#64748b" }}>{plan.duration_days} días</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const date = new Date(review.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "short" });
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e293b", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
          {review.user_avatar ? <img src={review.user_avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{review.user_name}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Stars rating={review.rating} size={12} />
            <span style={{ fontSize: 11, color: "#475569" }}>{date}</span>
          </div>
        </div>
      </div>
      {review.comment && <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{review.comment}</p>}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function SchoolProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { school, loading, error } = useSchoolDetail(id ?? null);
  const { isFavorito, toggleFavorito } = useFavoritos();
  const { share, copied } = useShare(school);
  const [tab, setTab]       = useState("programas");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#020817", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <span style={{ fontSize: 48 }}>😕</span>
      <p style={{ color: "#94a3b8" }}>No encontramos esta escuela</p>
      <button onClick={() => navigate("/explore")} style={{ padding: "10px 24px", borderRadius: 8, background: "#1e293b", color: "#f1f5f9", border: "none", cursor: "pointer" }}>← Volver</button>
    </div>
  );

  const accent       = school ? accentFor(school) : "#6366f1";
  const favActive    = id ? isFavorito(id) : false;
  const directionsUrl = school ? buildDirectionsUrl(school) : "#";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .fade-up{animation:fadeUp 0.45s ease both}
        .icon-btn{background:rgba(15,23,42,0.85);border:1px solid #1e293b;border-radius:10px;padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s;font-family:inherit;font-size:13px;font-weight:600}
        .icon-btn:hover{background:#1e293b;border-color:#334155}
      `}</style>

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "12px 20px", background: scrolled ? "rgba(2,8,23,0.95)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? "1px solid #1e293b" : "none", transition: "all 0.3s", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/explore")} style={{ background: "#1e293b", border: "none", color: "#94a3b8", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
          ← Explorar
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="icon-btn" onClick={share} style={{ color: copied ? "#22c55e" : "#94a3b8", borderColor: copied ? "#22c55e44" : "#1e293b" }}>
            {copied ? "✓ Copiado" : "⎋ Compartir"}
          </button>
          <button className="icon-btn" onClick={() => id && toggleFavorito(id)} style={{ color: favActive ? "#f59e0b" : "#94a3b8", borderColor: favActive ? "#f59e0b44" : "#1e293b", fontSize: 16 }}>
            {favActive ? "★" : "☆"}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div style={{ position: "relative", height: 280, overflow: "hidden" }}>
        {loading ? <Sk w="100%" h={280} r={0} /> : (
          <>
            {school?.cover_image_url
              ? <img src={school.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", background: `radial-gradient(ellipse at 30% 50%,${accent}33 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,${accent}1a 0%,transparent 50%),#0a1628` }} />
            }
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 20%,#020817 100%)" }} />
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px 80px" }}>

        {/* Header */}
        <div className="fade-up" style={{ marginTop: -60, position: "relative", zIndex: 10, display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: 18, flexShrink: 0, background: school?.logo_url ? "#fff" : `${accent}22`, border: `3px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", fontSize: 32, boxShadow: `0 8px 24px ${accent}44` }}>
            {loading ? <Sk w={80} h={80} r={18} /> : (school?.logo_url ? <img src={school.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏫")}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Sk w={220} h={28} /><Sk w={140} h={16} /></div>
            : school ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#f1f5f9", fontFamily: "Sora,sans-serif", lineHeight: 1.2 }}>{school.name}</h1>
                  {school.verified && <span style={{ background: "#22c55e22", border: "1px solid #22c55e66", borderRadius: 20, padding: "2px 10px", fontSize: 11, color: "#22c55e", fontWeight: 700 }}>✓ Verificada</span>}
                  <span style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: school.is_open_now ? "#22c55e22" : "#ef444422", color: school.is_open_now ? "#22c55e" : "#ef4444", border: `1px solid ${school.is_open_now ? "#22c55e44" : "#ef444444"}` }}>
                    {school.is_open_now ? "🟢 Abierto" : "🔴 Cerrado"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>📍 {school.city}</span>
                  {school.avg_rating > 0 && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Stars rating={school.avg_rating} size={13} /><span style={{ fontSize: 12, color: "#94a3b8" }}>{Number(school.avg_rating).toFixed(1)} ({school.review_count})</span></div>}
                  {school.min_price && <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>Desde {cop(school.min_price)}/mes</span>}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* Descripción + deportes */}
        {!loading && school?.description && <p className="fade-up" style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 16px" }}>{school.description}</p>}
        {!loading && school && (
          <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {(school.sports ?? school.team_sports ?? []).map(s => (
              <span key={s} style={{ fontSize: 12, padding: "4px 12px", borderRadius: 20, background: `${SPORT_COLORS[s] ?? accent}18`, color: SPORT_COLORS[s] ?? accent, border: `1px solid ${SPORT_COLORS[s] ?? accent}44`, fontWeight: 600 }}>{s}</span>
            ))}
          </div>
        )}

        {/* Contacto + Cómo llegar */}
        {!loading && school && (
          <div className="fade-up" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28, alignItems: "stretch" }}>
            {(school.phone || school.email || school.website) && (
              <div style={{ flex: 1, minWidth: 180, padding: "12px 16px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {school.phone   && <a href={`tel:${school.phone}`}         style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none" }}>📞 {school.phone}</a>}
                {school.email   && <a href={`mailto:${school.email}`}      style={{ fontSize: 13, color: "#94a3b8", textDecoration: "none" }}>✉️ {school.email}</a>}
                {school.website && <a href={school.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: accent, textDecoration: "none" }}>🌐 Sitio web ↗</a>}
              </div>
            )}
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 24px", borderRadius: 12, textDecoration: "none", background: `linear-gradient(135deg,${accent},${accent}cc)`, color: "#fff", fontSize: 14, fontWeight: 700, boxShadow: `0 4px 16px ${accent}44`, minWidth: 160, transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = "none"; }}
            >
              🗺️ Cómo llegar
            </a>
          </div>
        )}

        {/* Tabs */}
        {!loading && school && (
          <>
            <div className="fade-up" style={{ marginBottom: 20 }}>
              <TabNav active={tab} onChange={setTab} accent={accent} />
            </div>

            {tab === "programas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {!(school.teams_detail?.length) ? <p style={{ color: "#475569", fontSize: 14 }}>Aún sin programas publicados.</p>
                  : school.teams_detail!.map(p => <ProgramCard key={p.id} program={p} accent={accent} />)}
              </div>
            )}

            {tab === "planes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {!(school.offerings_detail?.length) ? <p style={{ color: "#475569", fontSize: 14 }}>Sin planes disponibles.</p>
                  : school.offerings_detail!.map(o => <OfferingCard key={o.id} offering={o} accent={accent} />)}
              </div>
            )}

            {tab === "instalaciones" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12 }}>
                {!(school.facilities_detail?.length) ? <p style={{ color: "#475569", fontSize: 14 }}>Sin instalaciones registradas.</p>
                  : school.facilities_detail!.map(f => (
                    <div key={f.id} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>🏟️</div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{f.name}</h4>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${accent}18`, color: accent }}>{f.type}</span>
                      {f.capacity && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>Capacidad: {f.capacity}</p>}
                    </div>
                  ))}
              </div>
            )}

            {/* ─── Tab Sedes + Mapa ─── */}
            {tab === "sedes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <SchoolMap branches={school.branches ?? []} accent={accent} />
                {(school.branches ?? []).map(b => (
                  <div key={b.id} style={{ background: "#0f172a", border: `1px solid ${b.is_main ? accent : "#1e293b"}`, borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{b.name}</h4>
                        {b.is_main && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 20, background: `${accent}22`, color: accent, fontWeight: 700 }}>Principal</span>}
                      </div>
                      {b.address && <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>📍 {b.address}{b.city ? `, ${b.city}` : ""}</p>}
                      {b.phone   && <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>📞 {b.phone}</p>}
                    </div>
                    <a
                      href={b.lat && b.lng
                        ? `https://www.openstreetmap.org/directions?to=${b.lat},${b.lng}#map=16/${b.lat}/${b.lng}`
                        : `https://www.openstreetmap.org/search?query=${encodeURIComponent([b.address, b.city, "Colombia"].filter(Boolean).join(", "))}`
                      }
                      target="_blank" rel="noopener noreferrer"
                      style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, background: `${accent}18`, color: accent, fontSize: 12, fontWeight: 600, textDecoration: "none", border: `1px solid ${accent}33` }}
                    >
                      🗺️ Ir aquí ↗
                    </a>
                  </div>
                ))}
              </div>
            )}

            {tab === "opiniones" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {school.review_count > 0 && (
                  <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 14, padding: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center", minWidth: 80 }}>
                      <div style={{ fontSize: 48, fontWeight: 800, color: accent, fontFamily: "Sora,sans-serif", lineHeight: 1 }}>{Number(school.avg_rating).toFixed(1)}</div>
                      <Stars rating={school.avg_rating} size={16} />
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{school.review_count} reseñas</div>
                    </div>
                    {school.rating_distribution && <div style={{ flex: 1, minWidth: 200 }}><RatingBars dist={school.rating_distribution} total={school.review_count} /></div>}
                  </div>
                )}
                {!(school.recent_reviews?.length) ? <p style={{ color: "#475569", fontSize: 14 }}>Aún sin reseñas.</p>
                  : school.recent_reviews!.map(r => <ReviewCard key={r.id} review={r} />)}
              </div>
            )}
          </>
        )}

        {loading && <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>{[1,2,3].map(i => <Sk key={i} w="100%" h={90} r={14} />)}</div>}
      </div>
    </>
  );
}
