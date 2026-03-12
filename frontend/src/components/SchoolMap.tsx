import { useEffect, useRef } from "react";
import type { Branch } from "@/types/school.types";

interface SchoolMapProps {
  branches: Branch[];
  accent?: string;
}

/**
 * Mapa interactivo con Leaflet + OpenStreetMap.
 * Sin API key. Sin Google Maps. 100% gratuito.
 * Carga Leaflet desde CDN la primera vez, luego se cachea en window.L.
 */
export function SchoolMap({ branches, accent = "#6366f1" }: SchoolMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);

  const validBranches = branches.filter((b) => b.lat && b.lng);

  useEffect(() => {
    if (!containerRef.current || validBranches.length === 0) return;
    if (mapRef.current) return; // ya inicializado

    function loadLeaflet(): Promise<any> {
      return new Promise((resolve) => {
        if ((window as any).L) {
          resolve((window as any).L);
          return;
        }

        // Leaflet CSS
        if (!document.getElementById("leaflet-css")) {
          const link  = document.createElement("link");
          link.id     = "leaflet-css";
          link.rel    = "stylesheet";
          link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        // Leaflet JS
        const script  = document.createElement("script");
        script.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve((window as any).L);
        document.head.appendChild(script);
      });
    }

    loadLeaflet().then((L) => {
      if (!containerRef.current || mapRef.current) return;

      const main   = validBranches.find((b) => b.is_main) ?? validBranches[0];
      const center: [number, number] = [main.lat!, main.lng!];

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // evita scroll accidental en página
        attributionControl: true,
      });
      mapRef.current = map;

      // Tiles OpenStreetMap — gratuito, sin key
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Icono SVG personalizado con el accent color de la escuela
      const makeIcon = (isMain: boolean) =>
        L.divIcon({
          className: "",
          iconSize:   [30, 40],
          iconAnchor: [15, 40],
          popupAnchor:[0, -42],
          html: `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 40" width="30" height="40">
              <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.716 23.284 0 15 0z"
                    fill="${isMain ? accent : "#64748b"}"
                    stroke="white" stroke-width="2"/>
              <circle cx="15" cy="15" r="6" fill="white" opacity="0.9"/>
            </svg>
          `,
        });

      const markers: any[] = [];

      validBranches.forEach((b) => {
        const marker = L.marker([b.lat!, b.lng!], { icon: makeIcon(b.is_main) }).addTo(map);

        // URL para navegar usando OpenStreetMap / app nativa de mapas del dispositivo
        const navUrl = `https://www.openstreetmap.org/directions?from=&to=${b.lat},${b.lng}#map=16/${b.lat}/${b.lng}`;

        marker.bindPopup(
          `<div style="font-family:'DM Sans',sans-serif;min-width:170px;padding:2px 0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <strong style="font-size:13px;color:#0f172a;">${b.name}</strong>
              ${b.is_main ? `<span style="font-size:10px;background:${accent}22;color:${accent};padding:1px 6px;border-radius:10px;font-weight:700;">Principal</span>` : ""}
            </div>
            ${b.address ? `<p style="margin:0 0 4px;font-size:12px;color:#64748b;">📍 ${b.address}${b.city ? `, ${b.city}` : ""}</p>` : ""}
            ${b.phone   ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;">📞 ${b.phone}</p>` : ""}
            <a href="${navUrl}" target="_blank" rel="noopener"
               style="display:inline-block;font-size:12px;color:${accent};font-weight:700;text-decoration:none;">
              🗺️ Cómo llegar ↗
            </a>
          </div>`,
          { maxWidth: 240 }
        );

        markers.push(marker);
      });

      // Ajustar vista para mostrar todos los markers
      if (markers.length === 1) {
        map.setView(center, 15);
      } else {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.25));
      }
    });

    // Cleanup al desmontar
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [validBranches.length, accent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sin coordenadas válidas
  if (validBranches.length === 0) {
    return (
      <div style={{
        height: 200, borderRadius: 12,
        background: "#0f172a", border: "1px solid #1e293b",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ fontSize: 32 }}>🗺️</span>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
          Ubicación no disponible aún
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "#475569" }}>
          Se actualizará automáticamente pronto
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: 300,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${accent}44`,
        boxShadow: `0 4px 20px ${accent}22`,
      }}
    />
  );
}
