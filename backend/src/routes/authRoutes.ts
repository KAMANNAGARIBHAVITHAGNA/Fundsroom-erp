import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';
import { authenticateJWT, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fundsroom-default-secret-key-12345';

function getDisplayNameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  const cleanPart = localPart.replace(/[._-]/g, ' ');
  return cleanPart
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

router.post('/login', async (req: express.Request, res: Response) => {
  const isDemoMode = process.env.DEMO_MODE === 'true';
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required.'
      }
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email syntax.'
      }
    });
  }

  try {
    const user = await db('users').where({ email }).first();

    if (isDemoMode) {
      // Demo authentication mode active
      let role = 'ADMIN';
      let fullName = '';
      let userId = 'demo-user';

      if (user) {
        // If it matches a seeded user, use their identity
        role = user.role;
        fullName = user.full_name;
        userId = user.id;
      } else {
        // Default to ADMIN or resolve role based on email if it starts with certain prefixes
        if (email.startsWith('sales')) role = 'SALES';
        else if (email.startsWith('warehouse')) role = 'WAREHOUSE';
        else if (email.startsWith('accounts')) role = 'ACCOUNTS';
        
        fullName = getDisplayNameFromEmail(email);
      }

      const token = jwt.sign(
        { userId, email, role, full_name: fullName, demo: true },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      return res.status(200).json({
        success: true,
        token,
        user: {
          id: userId,
          email,
          full_name: fullName,
          role,
          demo: true
        }
      });
    }

    // Normal production path
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        }
      });
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password.'
        }
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'User account is suspended.'
        }
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error: any) {
    return handleServerError(res, error, 'An error occurred during login.');
  }
});

router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Not logged in.'
      }
    });
  }

  // Handle demo token verification on page refresh
  if ((req.user as any).demo || req.user.userId === 'demo-user') {
    const role = req.user.role;
    const email = req.user.email;
    const fullName = (req.user as any).full_name || getDisplayNameFromEmail(email);
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.userId,
        email: email,
        full_name: fullName,
        role: role,
        demo: true
      }
    });
  }

  try {
    const user = await db('users').where({ id: req.user.userId }).first();
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found.'
        }
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

export default router;
