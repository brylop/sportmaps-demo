import { Request, Response } from "express";
import { supabase } from "../config/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────

function parseNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

function parseBool(val: unknown): boolean | undefined {
  if (val === "true" || val === true) return true;
  if (val === "false" || val === false) return false;
  return undefined;
}

// ─── controller ─────────────────────────────────────────────────────────────

export const explorarController = {

  /**
   * GET /api/explorar
   * Lista paginada con todos los filtros via RPC search_schools
   */
  async search(req: Request, res: Response) {
    try {
      const {
        query,
        city,
        sport,
        price_max,
        rating_min,
        age,
        verified,
        open_now,
        lat,
        lng,
        distance_km,
        order_by = "rating",
        page = "1",
        limit = "24",
      } = req.query as Record<string, string>;

      const params: Record<string, unknown> = {
        p_page:  parseNum(page, 1),
        p_limit: parseNum(limit, 24),
        p_order_by: order_by,
      };

      if (query)       params.p_query       = query;
      if (city)        params.p_city        = city;
      if (sport)       params.p_sport       = sport;
      if (price_max)   params.p_price_max   = parseNum(price_max, 0);
      if (rating_min)  params.p_rating_min  = parseNum(rating_min, 0);
      if (age)         params.p_age         = parseNum(age, 0);
      if (verified)    params.p_verified    = parseBool(verified);
      if (open_now)    params.p_open_now    = parseBool(open_now);
      if (lat && lng) {
        params.p_lat = parseFloat(lat);
        params.p_lng = parseFloat(lng);
        if (distance_km) params.p_distance_km = parseNum(distance_km, 10);
      }

      const { data, error } = await supabase.rpc("search_schools", params);

      if (error) throw error;

      return res.json({
        ok: true,
        data: data?.data ?? [],
        pagination: data?.pagination ?? null,
        filters_applied: data?.filters_applied ?? {},
      });
    } catch (err: any) {
      console.error("[explorar.search]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * GET /api/explorar/cerca
   * Escuelas cercanas a coordenadas via RPC schools_near_location
   */
  async cerca(req: Request, res: Response) {
    try {
      const { lat, lng, radius_km = "5" } = req.query as Record<string, string>;

      if (!lat || !lng) {
        return res.status(400).json({ ok: false, error: "lat y lng son requeridos" });
      }

      const { data, error } = await supabase.rpc("schools_near_location", {
        p_lat:       parseFloat(lat),
        p_lng:       parseFloat(lng),
        p_radius_km: parseNum(radius_km, 5),
      });

      if (error) throw error;

      return res.json({ ok: true, data: data ?? [] });
    } catch (err: any) {
      console.error("[explorar.cerca]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * GET /api/explorar/:id
   * Perfil completo con todo embebido via school_detail_view
   */
  async detalle(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const { data, error } = await supabase
        .from("school_detail_view")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return res.status(404).json({ ok: false, error: "Escuela no encontrada" });
        }
        throw error;
      }

      return res.json({ ok: true, data });
    } catch (err: any) {
      console.error("[explorar.detalle]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /**
   * GET /api/explorar/meta/categorias
   * Lista de categorías/deportes disponibles
   */
  async categorias(_req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from("sports_categories")
        .select("id, name, icon")
        .order("name");

      if (error) throw error;

      return res.json({ ok: true, data: data ?? [] });
    } catch (err: any) {
      console.error("[explorar.categorias]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },
};
