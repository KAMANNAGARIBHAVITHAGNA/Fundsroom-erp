import express, { Response } from 'express';
import { z } from 'zod';
import { db } from '../config/db';
import { authenticateJWT, requireRole, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  business_name: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  customer_type: z.enum(['Retail', 'Wholesale', 'Distributor']),
  address: z.string().optional().nullable(),
  status: z.enum(['Lead', 'Active', 'Inactive']).default('Active'),
  follow_up_date: z.string().optional().nullable(),
});

// GET /api/customers - List with pagination and search
router.get('/', authenticateJWT, requireRole(['ADMIN', 'SALES', 'ACCOUNTS']), async (req: AuthRequest, res: Response) => {
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string || '1', 10);
  const limit = parseInt(req.query.limit as string || '20', 10);
  const offset = (page - 1) * limit;

  try {
    let query = db('customers');

    if (search) {
      query = query.where((builder) => {
        builder.where('name', 'like', `%${search}%`)
               .orWhere('business_name', 'like', `%${search}%`)
               .orWhere('phone', 'like', `%${search}%`);
      });
    }

    const totalRes = await query.clone().count({ count: '*' }).first();
    const total = totalRes ? parseInt(totalRes.count as string, 10) : 0;

    const customers = await query.orderBy('name', 'asc').limit(limit).offset(offset);

    return res.status(200).json({
      success: true,
      customers,
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

// POST /api/customers - Create customer
router.post('/', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  try {
    const data = customerSchema.parse(req.body);
    const id = `c_${Date.now()}`;
    const newCustomer = {
      id,
      ...data,
      created_by: req.user?.userId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('customers').insert(newCustomer);

    // Log Activity
    await db('activity_logs').insert({
      id: `act_${Date.now()}`,
      action: 'CUSTOMER_CREATED',
      description: `Customer ${data.name} (${data.business_name || ''}) was created.`,
      created_by: req.user?.userId || 'system'
    });

    return res.status(201).json({
      success: true,
      customer: newCustomer
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

// GET /api/customers/:id - Customer details, notes & challans history
router.get('/:id', authenticateJWT, requireRole(['ADMIN', 'SALES', 'ACCOUNTS']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const customer = await db('customers').where({ id }).first();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found.' }
      });
    }

    const notes = await db('customer_notes').where({ customer_id: id }).orderBy('created_at', 'desc');
    const challans = await db('challans').where({ customer_id: id }).orderBy('created_at', 'desc');

    return res.status(200).json({
      success: true,
      customer,
      notes,
      challans
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// PATCH /api/customers/:id - Update customer
router.patch('/:id', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const existing = await db('customers').where({ id }).first();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found.' }
      });
    }

    const updateSchema = customerSchema.partial();
    const data = updateSchema.parse(req.body);

    const updated = {
      ...data,
      updated_at: new Date()
    };

    await db('customers').where({ id }).update(updated);

    return res.status(200).json({
      success: true,
      customer: { ...existing, ...updated }
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

// POST /api/customers/:id/notes - Add follow-up note
router.post('/:id/notes', authenticateJWT, requireRole(['ADMIN', 'SALES']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || content.trim() === '') {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Note content is required.' }
    });
  }

  try {
    const customer = await db('customers').where({ id }).first();
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Customer not found.' }
      });
    }

    // Retrieve caller details
    const user = await db('users').where({ id: req.user?.userId }).first();

    const noteId = `cn_${Date.now()}`;
    const newNote = {
      id: noteId,
      customer_id: id,
      content,
      created_by: req.user?.userId,
      created_by_name: user?.full_name || 'Sales Agent',
      created_at: new Date()
    };

    await db('customer_notes').insert(newNote);

    // Log Activity
    await db('activity_logs').insert({
      id: `act_${Date.now()}`,
      action: 'CUSTOMER_NOTE_ADDED',
      description: `Note added to customer ${customer.name} by ${user?.full_name || 'Agent'}.`,
      created_by: req.user?.userId || 'system'
    });

    return res.status(201).json({
      success: true,
      note: newNote
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

export default router;
