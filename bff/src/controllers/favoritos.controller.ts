import { Request, Response } from "express";
import { supabase } from "../config/supabase";

/**
 * Todas las funciones usan SECURITY DEFINER en BD,
 * pero necesitan el JWT del usuario para que auth.uid() funcione.
 * Lo pasamos via supabase.auth.setSession en cada request
 * (el authMiddleware ya valida y adjunta req.userToken).
 */

export const favoritosController = {

  /** GET /api/favoritos → string[] de school_ids */
  async list(req: Request, res: Response) {
    try {
      const token = (req as any).userToken as string;

      // Usar supabase con el JWT del usuario
      const { data, error } = await supabase
        .rpc("get_my_favorites")
        .setHeader("Authorization", `Bearer ${token}`);

      if (error) throw error;

      return res.json({ ok: true, data: data ?? [] });
    } catch (err: any) {
      console.error("[favoritos.list]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /** POST /api/favoritos/toggle → { school_id: uuid } */
  async toggle(req: Request, res: Response) {
    try {
      const token     = (req as any).userToken as string;
      const { school_id } = req.body as { school_id: string };

      if (!school_id) {
        return res.status(400).json({ ok: false, error: "school_id requerido" });
      }

      const { data, error } = await supabase
        .rpc("toggle_favorite", { p_school_id: school_id })
        .setHeader("Authorization", `Bearer ${token}`);

      if (error) throw error;

      // data = { saved: true } o { saved: false }
      return res.json({ ok: true, ...data });
    } catch (err: any) {
      console.error("[favoritos.toggle]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },

  /** POST /api/favoritos/migrate → { school_ids: string[] } */
  async migrate(req: Request, res: Response) {
    try {
      const token      = (req as any).userToken as string;
      const { school_ids } = req.body as { school_ids: string[] };

      if (!school_ids || !Array.isArray(school_ids)) {
        return res.status(400).json({ ok: false, error: "school_ids requerido (array)" });
      }

      const { data, error } = await supabase
        .rpc("migrate_local_favorites", { p_school_ids: school_ids })
        .setHeader("Authorization", `Bearer ${token}`);

      if (error) throw error;

      return res.json({ ok: true, migrated: data ?? 0 });
    } catch (err: any) {
      console.error("[favoritos.migrate]", err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  },
};
