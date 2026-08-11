import express, { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { authenticateJWT, requireRole, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

// GET /api/inventory - Overview metrics
router.get('/', authenticateJWT, requireRole(['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS']), async (req: AuthRequest, res: Response) => {
  try {
    const products = await db('products');
    
    const totalProducts = products.length;
    const totalStock = products.reduce((acc, p) => acc + p.current_stock, 0);
    const totalValue = products.reduce((acc, p) => acc + (p.current_stock * p.unit_price), 0);
    const lowStockCount = products.filter(p => p.current_stock < p.minimum_stock).length;

    // Active customers
    const customerCountRes = await db('customers').count({ count: '*' }).first();
    const activeCustomers = customerCountRes ? parseInt(customerCountRes.count as string, 10) : 0;

    // Challans count today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const challanCountRes = await db('challans').where('created_at', '>=', startOfToday).count({ count: '*' }).first();
    const todayChallans = challanCountRes ? parseInt(challanCountRes.count as string, 10) : 0;

    // Pending follow-ups today
    const followUpsRes = await db('customers').where('follow_up_date', 'like', `%${new Date().toISOString().split('T')[0]}%`).count({ count: '*' }).first();
    const pendingFollowUps = followUpsRes ? parseInt(followUpsRes.count as string, 10) : 0;

    return res.status(200).json({
      success: true,
      metrics: {
        totalProducts,
        totalStock,
        totalValue,
        lowStockCount,
        activeCustomers,
        todayChallans,
        pendingFollowUps
      }
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// GET /api/inventory/movements - Stock movement ledger
router.get('/movements', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const movements = await db('stock_movements')
      .join('products', 'stock_movements.product_id', '=', 'products.id')
      .select(
        'stock_movements.*',
        'products.name as product_name',
        'products.sku as product_sku'
      )
      .orderBy('stock_movements.created_at', 'desc')
      .limit(100);

    return res.status(200).json({
      success: true,
      movements
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// GET /api/inventory/low-stock - List low stock items
router.get('/low-stock', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const lowStockProducts = await db('products')
      .whereRaw('current_stock < minimum_stock')
      .orderBy('name', 'asc');

    return res.status(200).json({
      success: true,
      products: lowStockProducts
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

const adjustSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  movement_type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  reason: z.string().min(1, 'Reason is required'),
});

// POST /api/inventory/adjust - Manual stock adjustment
router.post('/adjust', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, movement_type, quantity, reason } = adjustSchema.parse(req.body);

    const product = await db('products').where({ id: product_id }).first();
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' }
      });
    }

    if (movement_type === 'OUT' && product.current_stock < quantity) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Insufficient stock for product ${product.name}.`,
          details: {
            requested: quantity,
            available: product.current_stock
          }
        }
      });
    }

    const newStock = movement_type === 'IN' 
      ? product.current_stock + quantity 
      : product.current_stock - quantity;

    await db.transaction(async (trx) => {
      // Update product stock
      await trx('products').where({ id: product_id }).update({
        current_stock: newStock,
        updated_at: new Date()
      });

      // Insert movement
      await trx('stock_movements').insert({
        id: `mov_${Date.now()}`,
        product_id,
        movement_type,
        quantity,
        reason,
        created_by: req.user?.userId || 'system',
        created_at: new Date()
      });

      // Log Activity
      await trx('activity_logs').insert({
        id: `act_${Date.now()}`,
        action: 'STOCK_ADJUSTMENT',
        description: `Manual adjustment: ${quantity} units of ${product.name} moved ${movement_type}. Reason: ${reason}.`,
        created_by: req.user?.userId || 'system'
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully.',
      current_stock: newStock
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    return handleServerError(res, error);
  }
});

export default router;
