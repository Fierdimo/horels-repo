import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../../middleware/authMiddleware';
import CreditConfigService from '../../services/v2/CreditConfigService';
import { CreditCalculationService } from '../../services/CreditCalculationService';

const router = Router();

/**
 * @route   GET /api/admin/credits/config
 * @desc    Get current credit system configuration
 * @access  Admin only
 */
router.get('/config', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const config = await CreditConfigService.getConfiguration();
    
    res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/CONFIG] Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/admin/credits/config
 * @desc    Update credit system configuration values
 * @access  Admin only
 * @body    { "BASE_SEASON_RED": 1200, "ROOM_DELUXE": 1.6, ... }
 */
router.patch('/config', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const userId = (req as any).user?.id;

    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron valores para actualizar'
      });
    }

    // Validate all values are numbers
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== 'number' || isNaN(value)) {
        return res.status(400).json({
          success: false,
          message: `Valor inválido para ${key}: debe ser un número`
        });
      }
    }

    const result = await CreditConfigService.updateConfiguration(updates, userId);

    // Clear cache after update
    CreditCalculationService.clearCache();

    if (result.errors.length > 0) {
      return res.status(207).json({
        success: true,
        message: `${result.updated.length} configuraciones actualizadas, ${result.errors.length} errores`,
        data: result
      });
    }

    res.json({
      success: true,
      message: `${result.updated.length} configuraciones actualizadas`,
      data: result
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/CONFIG] Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/credits/config/reset
 * @desc    Reset configuration to default values
 * @access  Admin only
 */
router.post('/config/reset', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    await CreditConfigService.resetToDefaults(userId);
    
    // Clear cache after reset
    CreditCalculationService.clearCache();

    res.json({
      success: true,
      message: 'Configuración restablecida a valores por defecto'
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/CONFIG] Error resetting configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer configuración',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/credits/auto-configure-units
 * @desc    Auto-configure room type multipliers for units based on category
 * @access  Admin only
 * @body    { property_id?: number, dry_run?: boolean, overwrite_manual?: boolean }
 */
router.post('/auto-configure-units', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { property_id, dry_run = true, overwrite_manual = false } = req.body;

    const result = await CreditConfigService.autoConfigureUnits({
      propertyId: property_id,
      dryRun: dry_run,
      overwriteManual: overwrite_manual
    });

    res.json({
      success: true,
      dry_run,
      data: result
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/AUTO-CONFIGURE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al auto-configurar unidades',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/admin/credits/units/:unitId/preview
 * @desc    Get configuration preview for a specific unit
 * @access  Admin only
 */
router.get('/units/:unitId/preview', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.unitId);
    
    if (isNaN(unitId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de unidad inválido'
      });
    }

    const preview = await CreditConfigService.getUnitPreview(unitId);

    res.json({
      success: true,
      data: preview
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/UNIT-PREVIEW] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener preview de unidad',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/admin/credits/units/:unitId/multiplier
 * @desc    Update room type multiplier for a specific unit
 * @access  Admin only
 * @body    { multiplier: number | null }
 */
router.patch('/units/:unitId/multiplier', authenticateToken, authorizeRole(['admin']), async (req: Request, res: Response) => {
  try {
    const unitId = parseInt(req.params.unitId);
    const { multiplier } = req.body;

    if (isNaN(unitId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de unidad inválido'
      });
    }

    if (multiplier !== null && (typeof multiplier !== 'number' || isNaN(multiplier))) {
      return res.status(400).json({
        success: false,
        message: 'Multiplicador debe ser un número o null'
      });
    }

    await CreditConfigService.updateUnitMultiplier(unitId, multiplier);

    res.json({
      success: true,
      message: 'Multiplicador actualizado correctamente'
    });
  } catch (error: any) {
    console.error('[ADMIN/CREDITS/UNIT-MULTIPLIER] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar multiplicador',
      error: error.message
    });
  }
});

export default router;
