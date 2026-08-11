import express, { Response } from 'express';
import { db } from '../config/db';
import { authenticateJWT, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

// GET /api/activity - Retrieve activity logs
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db('activity_logs')
      .orderBy('created_at', 'desc')
      .limit(50);

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

export default router;
