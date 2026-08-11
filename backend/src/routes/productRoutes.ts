import express, { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { authenticateJWT, requireRole, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  category: z.string().optional().nullable(),
  unit_price: z.number().positive('Unit price must be positive'),
  current_stock: z.number().int().nonnegative('Stock cannot be negative').default(0),
  minimum_stock: z.number().int().nonnegative('Minimum stock cannot be negative').default(10),
  location: z.string().optional().nullable(),
});

// GET /api/products - List with pagination and search
router.get('/', authenticateJWT, requireRole(['ADMIN', 'SALES', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);
  const offset = (page - 1) * limit;

  try {
    let query = db('products');

    if (search) {
      query = query.where((builder) => {
        builder.where('name', 'like', `%${search}%`)
               .orWhere('sku', 'like', `%${search}%`);
      });
    }

    const totalRes = await query.clone().count({ count: '*' }).first();
    const total = totalRes ? parseInt(totalRes.count as string, 10) : 0;

    const products = await query.orderBy('name', 'asc').limit(limit).offset(offset);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// POST /api/products - Create product
router.post('/', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const data = productSchema.parse(req.body);

    // Check SKU uniqueness
    const existing = await db('products').where({ sku: data.sku }).first();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_SKU', message: `Product with SKU ${data.sku} already exists.` }
      });
    }

    const id = `p_${Date.now()}`;
    const newProduct = {
      id,
      ...data,
      created_by: req.user?.userId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('products').insert(newProduct);

    // Log stock movement for initial stock if > 0
    if (data.current_stock > 0) {
      await db('stock_movements').insert({
        id: `mov_${Date.now()}`,
        product_id: id,
        movement_type: 'IN',
        quantity: data.current_stock,
        reason: 'Initial stock setup',
        created_by: req.user?.userId || 'system',
        reference: null,
        created_at: new Date()
      });
    }

    // Log Activity
    await db('activity_logs').insert({
      id: `act_${Date.now()}`,
      action: 'PRODUCT_CREATED',
      description: `Product ${data.name} (SKU: ${data.sku}) created with stock ${data.current_stock}.`,
      created_by: req.user?.userId || 'system'
    });

    return res.status(201).json({
      success: true,
      product: newProduct
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

// GET /api/products/:id - Product detail & recent movements
router.get('/:id', authenticateJWT, requireRole(['ADMIN', 'SALES', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const product = await db('products').where({ id }).first();
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' }
      });
    }

    const movements = await db('stock_movements')
      .where({ product_id: id })
      .orderBy('created_at', 'desc')
      .limit(10);

    return res.status(200).json({
      success: true,
      product,
      movements
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// PATCH /api/products/:id - Update product details
router.patch('/:id', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await db('products').where({ id }).first();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found.' }
      });
    }

    const updateSchema = productSchema.partial();
    const data = updateSchema.parse(req.body);

    // If updating SKU, make sure it is unique
    if (data.sku && data.sku !== existing.sku) {
      const duplicate = await db('products').where({ sku: data.sku }).first();
      if (duplicate) {
        return res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_SKU', message: `Product with SKU ${data.sku} already exists.` }
        });
      }
    }

    const updated = {
      ...data,
      updated_at: new Date()
    };

    await db('products').where({ id }).update(updated);

    return res.status(200).json({
      success: true,
      product: { ...existing, ...updated }
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
