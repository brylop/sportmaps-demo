import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/authMiddleware';
import { pollsController } from '../controllers/polls.controller';

const router = Router();

// ── Rutas autenticadas (Admin / Coach) ──────────────────────────────────────
router.get('/', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.listPolls);
router.post('/', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.createPoll);
router.get('/:pollId/results', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.getPollResults);
router.patch('/:pollId/close', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.closePoll);
router.delete('/:pollId', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.deletePoll);

// ── Confirmaciones manuales (Admin / Coach) ─────────────────────────────────
router.post('/:pollId/sessions/:sessionId/confirmations', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.addManualConfirmation);
router.patch('/:pollId/sessions/:sessionId/confirmations/:bookingId', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.updateConfirmation);
router.delete('/:pollId/sessions/:sessionId/confirmations/:bookingId', requireAuth, requireRole('coach', 'staff', 'school_admin'), pollsController.deleteConfirmation);

// ── Rutas públicas (sin auth) ───────────────────────────────────────────────
router.get('/:pollId/public', pollsController.getPublicPoll);
router.post('/:pollId/confirm', pollsController.confirmAttendance);

export default router;
