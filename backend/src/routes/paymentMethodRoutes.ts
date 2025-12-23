import { Request, Response, Router } from 'express';
import { PaymentMethodService } from '../services/paymentMethodService';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Create setup intent for adding payment method
router.post('/setup-intent', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const result = await PaymentMethodService.createSetupIntent(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create setup intent' });
  }
});

// Save payment method
router.post('/save-method', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    await PaymentMethodService.savePaymentMethod(userId, paymentMethodId);
    res.json({ success: true, message: 'Payment method saved successfully' });
  } catch (error: any) {
    console.error('Error saving payment method:', error);
    res.status(500).json({ error: error.message || 'Failed to save payment method' });
  }
});

// Get user's payment methods
router.get('/methods', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const methods = await PaymentMethodService.getPaymentMethods(userId);
    res.json({ success: true, data: methods });
  } catch (error: any) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch payment methods' });
  }
});

// Remove payment method
router.delete('/methods/:methodId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { methodId } = req.params;

    await PaymentMethodService.removePaymentMethod(userId, methodId);
    res.json({ success: true, message: 'Payment method removed successfully' });
  } catch (error: any) {
    console.error('Error removing payment method:', error);
    res.status(500).json({ error: error.message || 'Failed to remove payment method' });
  }
});

// Check if user has payment method
router.get('/has-method', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const hasMethod = await PaymentMethodService.hasPaymentMethod(userId);
    res.json({ success: true, data: { hasPaymentMethod: hasMethod } });
  } catch (error: any) {
    console.error('Error checking payment method:', error);
    res.status(500).json({ error: error.message || 'Failed to check payment method' });
  }
});

export default router;
