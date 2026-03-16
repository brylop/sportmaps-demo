import { Router } from "express";
import { explorarController } from "../controllers/explorar.controller";

const router = Router();

// GET /api/explorar
// Query params: query, city, sport, price_max, rating_min, age,
//               verified, open_now, lat, lng, distance_km,
//               order_by, page, limit
router.get("/", explorarController.search);

// GET /api/explorar/cerca
// Query params: lat, lng, radius_km
router.get("/cerca", explorarController.cerca);

// GET /api/explorar/:id
router.get("/:id", explorarController.detalle);

// GET /api/explorar/categorias
router.get("/meta/categorias", explorarController.categorias);

export default router;
