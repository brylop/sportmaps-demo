import { Router } from 'express';
import { pollsController } from '../controllers/polls.controller';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// ── Rutas públicas (link compartido por WhatsApp, sin auth) ──────────────────
router.get('/:pollId/public',         pollsController.getPublicPoll);
router.post('/:pollId/confirm',       pollsController.confirmAttendance);

// ── Rutas autenticadas ───────────────────────────────────────────────────────
router.use(requireAuth);

// Admin y coach
router.get('/',                       requireRole('owner','admin','school_admin','coach'), pollsController.listPolls);
router.get('/:pollId/results',        requireRole('owner','admin','school_admin','coach'), pollsController.getPollResults);

// Solo admin
router.post('/',                      requireRole('owner','admin','school_admin'), pollsController.createPoll);
router.patch('/:pollId/close',        requireRole('owner','admin','school_admin'), pollsController.closePoll);
router.delete('/:pollId',             requireRole('owner','admin','school_admin'), pollsController.deletePoll);

// CRUD de confirmaciones (admin puede agregar/editar/eliminar manualmente)
router.post('/:pollId/sessions/:sessionId/confirmations',          requireRole('owner','admin','school_admin','coach'), pollsController.addManualConfirmation);
router.patch('/:pollId/sessions/:sessionId/confirmations/:bookingId', requireRole('owner','admin','school_admin','coach'), pollsController.updateConfirmation);
router.delete('/:pollId/sessions/:sessionId/confirmations/:bookingId', requireRole('owner','admin','school_admin','coach'), pollsController.deleteConfirmation);

export default router;
