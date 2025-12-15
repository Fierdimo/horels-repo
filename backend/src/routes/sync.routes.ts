import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { pmsSyncWorker } from '../workers/pmsSyncWorker';
import { Property, PMSSyncLog } from '../models';
import { Op } from 'sequelize';

const router = Router();

/**
 * @route   POST /api/sync/start
 * @desc    Iniciar worker de sincronización
 * @access  Private (admin only)
 */
router.post(
  '/start',
  authenticateToken,
  authorize(['view_users']), // Solo admin
  logAction('start_sync_worker'),
  async (req: Request, res: Response) => {
    try {
      const { interval } = req.body;
      const intervalMs = interval ? parseInt(interval) : undefined;

      pmsSyncWorker.start(intervalMs);

      res.json({
        success: true,
        message: 'Sync worker started',
        status: pmsSyncWorker.getStatus()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to start sync worker',
        message: error.message
      });
    }
  }
);

/**
 * @route   POST /api/sync/stop
 * @desc    Detener worker de sincronización
 * @access  Private (admin only)
 */
router.post(
  '/stop',
  authenticateToken,
  authorize(['view_users']), // Solo admin
  logAction('stop_sync_worker'),
  async (req: Request, res: Response) => {
    try {
      pmsSyncWorker.stop();

      res.json({
        success: true,
        message: 'Sync worker stopped',
        status: pmsSyncWorker.getStatus()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to stop sync worker',
        message: error.message
      });
    }
  }
);

/**
 * @route   GET /api/sync/status
 * @desc    Obtener estado del worker
 * @access  Private (admin only)
 */
router.get(
  '/status',
  authenticateToken,
  authorize(['view_users']), // Solo admin
  async (req: Request, res: Response) => {
    try {
      const status = pmsSyncWorker.getStatus();

      res.json({
        success: true,
        data: status
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to get sync status',
        message: error.message
      });
    }
  }
);

/**
 * @route   POST /api/sync/trigger
 * @desc    Ejecutar sincronización manual
 * @access  Private (admin and staff can sync their properties)
 */
router.post(
  '/trigger',
  authenticateToken,
  logAction('trigger_manual_sync'),
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { propertyIds, syncType, forceSync } = req.body;

      // Validar permisos
      const userRole = user.Role?.name || user.role;
      let allowedPropertyIds = propertyIds;

      if (userRole !== 'admin') {
        // Staff solo puede sincronizar su propia property
        if (userRole === 'staff' && user.property_id) {
          allowedPropertyIds = [user.property_id];
        } else {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions to trigger sync'
          });
        }
      }

      // Ejecutar sincronización
      await pmsSyncWorker.syncAll({
        syncType: syncType || 'full',
        forceSync: forceSync || false,
        propertyIds: allowedPropertyIds
      });

      res.json({
        success: true,
        message: 'Sync triggered successfully',
        options: {
          syncType: syncType || 'full',
          forceSync: forceSync || false,
          propertyIds: allowedPropertyIds
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
        message: error.message
      });
    }
  }
);

/**
 * @route   GET /api/sync/logs
 * @desc    Obtener logs de sincronización
 * @access  Private (admin can see all, staff can see their property)
 */
router.get(
  '/logs',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { page = 1, limit = 50, property_id, status } = req.query;

      const userRole = user.Role?.name || user.role;
      const offset = (Number(page) - 1) * Number(limit);

      const where: any = {};

      // Filtrar por property_id
      if (property_id) {
        where.property_id = property_id;
      }

      // Staff solo puede ver logs de su property
      if (userRole === 'staff' && user.property_id) {
        where.property_id = user.property_id;
      }

      // Filtrar por status
      if (status) {
        where.status = status;
      }

      const logs = await PMSSyncLog.findAndCountAll({
        where,
        limit: Number(limit),
        offset,
        order: [['started_at', 'DESC']],
        include: [{
          model: Property,
          attributes: ['id', 'name', 'pms_provider']
        }]
      });

      res.json({
        success: true,
        data: logs.rows,
        pagination: {
          total: logs.count,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(logs.count / Number(limit))
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sync logs',
        message: error.message
      });
    }
  }
);

/**
 * @route   GET /api/sync/logs/:id
 * @desc    Obtener detalle de un log de sincronización
 * @access  Private (admin can see all, staff can see their property)
 */
router.get(
  '/logs/:id',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const userRole = user.Role?.name || user.role;

      const log = await PMSSyncLog.findByPk(id, {
        include: [{
          model: Property,
          attributes: ['id', 'name', 'pms_provider', 'pms_property_id']
        }]
      });

      if (!log) {
        return res.status(404).json({
          success: false,
          error: 'Sync log not found'
        });
      }

      // Staff solo puede ver logs de su property
      if (userRole === 'staff' && user.property_id !== log.property_id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: log
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sync log',
        message: error.message
      });
    }
  }
);

export default router;
