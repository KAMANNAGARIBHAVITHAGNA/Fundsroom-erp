import express, { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { authenticateJWT, requireRole, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

const challanItemSchema = z.object({
  product_id: z.string().min(1),
  quantity: z.number().int().positive('Quantity must be positive'),
});

const challanSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  notes: z.string().optional().nullable(),
  items: z.array(challanItemSchema).min(1, 'At least one item is required'),
});

// GET /api/challans - List challans
router.get('/', authenticateJWT, requireRole(['ADMIN', 'SALES', 'ACCOUNTS']), async (req: AuthRequest, res: Response) => {
  try {
    const challans = await db('challans')
      .join('customers', 'challans.customer_id', '=', 'customers.id')
      .select(
        'challans.*',
        'customers.name as customer_name',
        'customers.business_name as customer_business_name'
      )
      .orderBy('challans.created_at', 'desc');

    return res.status(200).json({
      success: true,
      challans
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// GET /api/challans/:id - Detail view
router.get('/:id', authenticateJWT, requireRole(['ADMIN', 'SALES', 'ACCOUNTS']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const challan = await db('challans')
      .join('customers', 'challans.customer_id', '=', 'customers.id')
      .select('challans.*', 'customers.name as customer_name', 'customers.phone as customer_phone', 'customers.gst_number as customer_gst')
      .where('challans.id', id)
      .first();

    if (!challan) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Challan not found.' }
      });
    }

    const items = await db('challan_items').where({ challan_id: id });

    return res.status(200).json({
      success: true,
      challan,
      items
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// POST /api/challans - Create draft challan (does not deduct stock)
router.post('/', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  try {
    const { customer_id, notes, items } = challanSchema.parse(req.body);

    // Validate customer exists
    const customer = await db('customers').where({ id: customer_id }).first();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found.' }
      });
    }

    // Generate Challan Number
    const countRes = await db('challans').count({ count: '*' }).first();
    const count = countRes ? parseInt(countRes.count as string, 10) : 0;
    const challan_number = `SC-${String(count + 1).padStart(5, '0')}`;

    const challanId = `sc_${Date.now()}`;
    let totalQuantity = 0;
    let totalAmount = 0;

    const challanItemsToInsert: any[] = [];

    // Fetch and validate products, build snapshot data
    for (const item of items) {
      const product = await db('products').where({ id: item.product_id }).first();
      if (!product) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Product with ID ${item.product_id} not found.` }
        });
      }

      const subtotal = product.unit_price * item.quantity;
      totalQuantity += item.quantity;
      totalAmount += subtotal;

      challanItemsToInsert.push({
        id: `sci_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        challan_id: challanId,
        product_id: item.product_id,
        product_name_snapshot: product.name,
        sku_snapshot: product.sku,
        unit_price_snapshot: product.unit_price,
        quantity: item.quantity,
        subtotal
      });
    }

    const newChallan = {
      id: challanId,
      challan_number,
      customer_id,
      status: 'Draft',
      total_quantity: totalQuantity,
      total_amount: totalAmount,
      notes,
      created_by: req.user?.userId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.transaction(async (trx) => {
      await trx('challans').insert(newChallan);
      await trx('challan_items').insert(challanItemsToInsert);

      // Log Activity
      await trx('activity_logs').insert({
        id: `act_${Date.now()}`,
        action: 'CHALLAN_CREATED',
        description: `Draft challan ${challan_number} created for customer ${customer.name}.`,
        created_by: req.user?.userId || 'system'
      });
    });

    return res.status(201).json({
      success: true,
      challan: newChallan,
      items: challanItemsToInsert
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

// POST /api/challans/:id/confirm - Confirm & deduct stock atomically
router.post('/:id/confirm', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    // Start Transaction
    await db.transaction(async (trx) => {
      const challan = await trx('challans').where({ id }).forUpdate().first();
      if (!challan) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Challan not found.' };
      }

      if (challan.status !== 'Draft') {
        throw { status: 400, code: 'BAD_REQUEST', message: `Cannot confirm challan in ${challan.status} status.` };
      }

      const items = await trx('challan_items').where({ challan_id: id });

      // Validate stock levels for all items
      for (const item of items) {
        const product = await trx('products').where({ id: item.product_id }).forUpdate().first();
        if (!product) {
          throw { status: 404, code: 'NOT_FOUND', message: `Product ${item.product_name_snapshot} not found.` };
        }

        if (product.current_stock < item.quantity) {
          // Insufficient stock triggers rollback and returns 409 conflict
          throw {
            status: 409,
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${product.name}.`,
            details: {
              requested: item.quantity,
              available: product.current_stock
            }
          };
        }
      }

      // Perform stock deduction and create movements
      for (const item of items) {
        const product = await trx('products').where({ id: item.product_id }).first();
        const updatedStock = product.current_stock - item.quantity;

        // Update product stock
        await trx('products').where({ id: item.product_id }).update({
          current_stock: updatedStock,
          updated_at: new Date()
        });

        // Add Stock Movement
        await trx('stock_movements').insert({
          id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          product_id: item.product_id,
          movement_type: 'OUT',
          quantity: item.quantity,
          reason: `Sales Challan ${challan.challan_number}`,
          created_by: req.user?.userId || 'system',
          reference: challan.challan_number,
          created_at: new Date()
        });
      }

      // Update challan status
      await trx('challans').where({ id }).update({
        status: 'Confirmed',
        confirmed_by: req.user?.userId,
        confirmed_at: new Date(),
        updated_at: new Date()
      });

      // Log Activity
      await trx('activity_logs').insert({
        id: `act_${Date.now()}`,
        action: 'CHALLAN_CONFIRMED',
        description: `Challan ${challan.challan_number} confirmed, stock synchronized.`,
        created_by: req.user?.userId || 'system'
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Challan confirmed successfully.'
    });
  } catch (error: any) {
    if (error.code) {
      return res.status(error.status || 500).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }
    return handleServerError(res, error);
  }
});

// POST /api/challans/:id/cancel - Cancel & optionally return stock
router.post('/:id/cancel', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    await db.transaction(async (trx) => {
      const challan = await trx('challans').where({ id }).forUpdate().first();
      if (!challan) {
        throw { status: 404, code: 'NOT_FOUND', message: 'Challan not found.' };
      }

      if (challan.status === 'Cancelled') {
        throw { status: 400, code: 'BAD_REQUEST', message: 'Challan is already cancelled.' };
      }

      const items = await trx('challan_items').where({ challan_id: id });

      // If the challan was Confirmed, we should return the stock back to inventory
      if (challan.status === 'Confirmed') {
        for (const item of items) {
          const product = await trx('products').where({ id: item.product_id }).first();
          if (product) {
            await trx('products').where({ id: item.product_id }).update({
              current_stock: product.current_stock + item.quantity,
              updated_at: new Date()
            });

            await trx('stock_movements').insert({
              id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              product_id: item.product_id,
              movement_type: 'IN',
              quantity: item.quantity,
              reason: `Reversal of Cancelled Challan ${challan.challan_number}`,
              created_by: req.user?.userId || 'system',
              reference: challan.challan_number,
              created_at: new Date()
            });
          }
        }
      }

      // Update status
      await trx('challans').where({ id }).update({
        status: 'Cancelled',
        updated_at: new Date()
      });

      // Log Activity
      await trx('activity_logs').insert({
        id: `act_${Date.now()}`,
        action: 'CHALLAN_CANCELLED',
        description: `Challan ${challan.challan_number} cancelled.`,
        created_by: req.user?.userId || 'system'
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Challan cancelled successfully.'
    });
  } catch (error: any) {
    if (error.code) {
      return res.status(error.status || 500).json({
        success: false,
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
    return handleServerError(res, error);
  }
});

export default router;
