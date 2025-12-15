import { Router } from 'express';
import roomController from '../controllers/roomController';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = Router();

// All routes protected for admin only
router.use(authenticateToken, authorizeRole(['admin']));

router.get('/', roomController.getAllRooms);
router.post('/', roomController.createRoom);
router.put('/:id', roomController.updateRoom);
router.delete('/:id', roomController.deleteRoom);

export default router;
