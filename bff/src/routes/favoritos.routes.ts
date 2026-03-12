import { Router } from "express";
import { requireBasicAuth } from "../middlewares/authMiddleware";
import { favoritosController } from "../controllers/favoritos.controller";

const router = Router();

// Todas las rutas de favoritos requieren autenticación básica (no forzar tener escuela)
router.use(requireBasicAuth);

// GET  /api/favoritos          → lista de school_ids del usuario
router.get("/",            favoritosController.list);

// POST /api/favoritos/toggle   → { school_id } → toggle en BD
router.post("/toggle",     favoritosController.toggle);

// POST /api/favoritos/migrate  → { school_ids } → migra anónimos al hacer login
router.post("/migrate",    favoritosController.migrate);

export default router;
