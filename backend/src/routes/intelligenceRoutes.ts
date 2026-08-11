import express, { Response } from 'express';
import { db } from '../config/db';
import { authenticateJWT, requireRole, AuthRequest, handleServerError } from '../middleware/auth';

const router = express.Router();

interface ConfidenceDetail {
  score: number;
  label: string;
  evidence: string;
}

function calculateConfidence(movementCount: number): ConfidenceDetail {
  if (movementCount === 0) {
    return {
      score: 50,
      label: 'LIMITED DATA',
      evidence: 'No historical stock movement data is available.'
    };
  }
  if (movementCount <= 3) {
    return {
      score: 65,
      label: 'EARLY SIGNAL',
      evidence: 'Limited historical movement data is available.'
    };
  }
  if (movementCount <= 10) {
    return {
      score: 80,
      label: 'MODERATE CONFIDENCE',
      evidence: 'Some historical movement data is available.'
    };
  }
  if (movementCount <= 30) {
    return {
      score: 90,
      label: 'STRONG CONFIDENCE',
      evidence: 'Sufficient historical movement data is available.'
    };
  }
  return {
    score: 95,
    label: 'HIGH CONFIDENCE',
    evidence: 'Strong historical movement evidence is available.'
  };
}

// Helper to calculate risk metrics for a single product
async function calculateProductRisk(product: any) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 1. Calculate 7-day OUT velocity
  const outMovements = await db('stock_movements')
    .where('product_id', product.id)
    .where('movement_type', 'OUT')
    .where('created_at', '>=', sevenDaysAgo);

  const velocity = outMovements.reduce((acc, mov) => acc + mov.quantity, 0);
  const dailyVelocity = velocity / 7;

  // 2. Calculate Pending Demand (from Draft challans)
  const pendingDemandRes = await db('challan_items')
    .join('challans', 'challan_items.challan_id', '=', 'challans.id')
    .where('challan_items.product_id', product.id)
    .where('challans.status', 'Draft')
    .sum({ total: 'challan_items.quantity' })
    .first();

  const pendingDemand = pendingDemandRes ? parseInt(pendingDemandRes.total as string || '0', 10) : 0;

  // 3. Project Stockout Days
  let projectedStockoutDays = 999;
  if (dailyVelocity > 0) {
    projectedStockoutDays = Math.max(0, Math.round(product.current_stock / dailyVelocity));
  } else if (product.current_stock === 0) {
    projectedStockoutDays = 0;
  }

  // 4. Calculate Risk Score and Level
  let riskLevel = 'LOW';
  let score = 10; // base score
  const reasons: string[] = [];

  // Stock threshold gaps
  if (product.current_stock === 0) {
    riskLevel = 'CRITICAL';
    score = 100;
    reasons.push('Current stock is completely depleted (0 units).');
  } else if (product.current_stock < product.minimum_stock) {
    if (product.current_stock <= product.minimum_stock / 2) {
      riskLevel = 'CRITICAL';
      score = 85;
      reasons.push(`Current stock (${product.current_stock}) is critically below 50% of the minimum stock threshold (${product.minimum_stock}).`);
    } else {
      riskLevel = 'HIGH';
      score = 70;
      reasons.push(`Current stock (${product.current_stock}) is below the minimum threshold (${product.minimum_stock}).`);
    }
  } else if (product.current_stock < product.minimum_stock * 1.3) {
    riskLevel = 'MEDIUM';
    score = 40;
    reasons.push(`Current stock (${product.current_stock}) is approaching the minimum safety threshold (${product.minimum_stock}).`);
  }

  // Velocity risks
  if (dailyVelocity > 0 && projectedStockoutDays <= 3 && product.current_stock > 0) {
    riskLevel = 'CRITICAL';
    score = Math.max(score, 90);
    reasons.push(`High outflow velocity (${velocity} units/7 days) suggests a potential stockout within ~3 days.`);
  } else if (dailyVelocity > 0 && projectedStockoutDays <= 7 && product.current_stock > 0) {
    riskLevel = Math.max(score, 70) === 70 ? 'HIGH' : riskLevel;
    score = Math.max(score, 75);
    reasons.push(`Steady outflow velocity suggests a potential stockout in ${projectedStockoutDays} days.`);
  }

  // Pending demand risks
  if (pendingDemand > 0) {
    const totalPotentialNeed = product.current_stock - pendingDemand;
    if (totalPotentialNeed < 0) {
      riskLevel = 'CRITICAL';
      score = Math.max(score, 95);
      reasons.push(`Pending draft challans demand ${pendingDemand} units, exceeding available stock by ${Math.abs(totalPotentialNeed)} units.`);
    } else if (totalPotentialNeed < product.minimum_stock) {
      riskLevel = riskLevel === 'LOW' ? 'MEDIUM' : riskLevel;
      score = Math.max(score, 55);
      reasons.push(`Pending draft challans will deplete stock to ${totalPotentialNeed} units, which is below safety levels.`);
    }
  }

  // Fetch movement count for confidence calculation
  const movementCountRes = await db('stock_movements').where('product_id', product.id).count({ count: '*' }).first();
  const movementCount = movementCountRes ? parseInt(movementCountRes.count as string, 10) : 0;
  const conf = calculateConfidence(movementCount);

  // Fallback for default low risk reasons
  if (reasons.length === 0) {
    reasons.push('Stock levels are stable with healthy safety margins.');
  }

  // Append confidence warning if 0 movements
  if (movementCount === 0) {
    reasons.push('Confidence is limited because this product has no historical stock movement data.');
  }

  // Recommended Action
  let recommendedAction = 'No action required.';
  if (riskLevel === 'CRITICAL') {
    recommendedAction = 'URGENT: Reorder inventory immediately. Hold approval of pending drafts.';
  } else if (riskLevel === 'HIGH') {
    recommendedAction = 'Action Recommended: Create purchase replenishment order. Review pending challan schedules.';
  } else if (riskLevel === 'MEDIUM') {
    recommendedAction = 'Monitor: Check sales trends and keep an eye on safety thresholds.';
  }

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    currentStock: product.current_stock,
    minimumStock: product.minimum_stock,
    outflowVelocity7d: velocity,
    projectedStockoutDays,
    pendingDemand,
    riskLevel,
    score,
    confidence: conf.score,
    confidenceLabel: conf.label,
    confidenceEvidence: conf.evidence,
    movementCount,
    reasons,
    recommendedAction
  };
}

// GET /api/intelligence/overview
router.get('/overview', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const products = await db('products');
    const risks = [];
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;

    for (const product of products) {
      const riskData = await calculateProductRisk(product);
      risks.push(riskData);
      if (riskData.riskLevel === 'CRITICAL') criticalCount++;
      else if (riskData.riskLevel === 'HIGH') highCount++;
      else if (riskData.riskLevel === 'MEDIUM') mediumCount++;
    }

    // Sort by risk score descending
    risks.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      success: true,
      summary: {
        totalAnalyzed: products.length,
        criticalCount,
        highCount,
        mediumCount,
        overallStatus: criticalCount > 0 ? 'CRITICAL_RISK' : (highCount > 0 ? 'ATTENTION_NEEDED' : 'STABLE')
      },
      risks
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// GET /api/intelligence/inventory-risks
router.get('/inventory-risks', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  try {
    const products = await db('products');
    const risks = [];
    for (const product of products) {
      const riskData = await calculateProductRisk(product);
      risks.push(riskData);
    }
    risks.sort((a, b) => b.score - a.score);
    return res.status(200).json({ success: true, risks });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// GET /api/intelligence/inventory-risks/:id/explanation
router.get('/inventory-risks/:id/explanation', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const product = await db('products').where({ id }).first();
    if (!product) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    }
    const riskData = await calculateProductRisk(product);
    return res.status(200).json({ success: true, explanation: riskData });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

// POST /api/intelligence/simulate - What-if simulation
router.post('/simulate', authenticateJWT, requireRole(['ADMIN', 'WAREHOUSE']), async (req: AuthRequest, res: Response) => {
  const { challan_ids } = req.body; // Array of draft challan IDs to simulate

  if (!challan_ids || !Array.isArray(challan_ids) || challan_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'challan_ids must be a non-empty array.' }
    });
  }

  try {
    const products = await db('products');
    const simulatedStockMap = new Map(products.map(p => [p.id, { ...p, projected_stock: p.current_stock }]));

    let affectedProductsCount = 0;
    let newRisksCount = 0;

    // Fetch challan items for all specified challans
    const items = await db('challan_items')
      .join('challans', 'challan_items.challan_id', '=', 'challans.id')
      .whereIn('challan_items.challan_id', challan_ids)
      .select('challan_items.*', 'challans.status');

    // Group items by product and subtract quantities
    for (const item of items) {
      const prod = simulatedStockMap.get(item.product_id);
      if (prod) {
        prod.projected_stock -= item.quantity;
      }
    }

    // Analyze new risks
    const affectedProducts: any[] = [];
    for (const [prodId, prod] of simulatedStockMap.entries()) {
      const originalRisk = await calculateProductRisk(prod);
      
      // Calculate risk with projected stock
      const tempProd = { ...prod, current_stock: Math.max(0, prod.projected_stock) };
      const simulatedRisk = await calculateProductRisk(tempProd);

      if (prod.projected_stock !== prod.current_stock) {
        affectedProductsCount++;
        
        const isNewRisk = (simulatedRisk.riskLevel === 'CRITICAL' || simulatedRisk.riskLevel === 'HIGH') &&
                          !(originalRisk.riskLevel === 'CRITICAL' || originalRisk.riskLevel === 'HIGH');
        if (isNewRisk) {
          newRisksCount++;
        }

        affectedProducts.push({
          productId: prodId,
          productName: prod.name,
          sku: prod.sku,
          originalStock: prod.current_stock,
          projectedStock: prod.projected_stock,
          originalRisk: originalRisk.riskLevel,
          projectedRisk: simulatedRisk.riskLevel,
          isNewRisk
        });
      }
    }

    return res.status(200).json({
      success: true,
      simulation: {
        affectedProductsCount,
        newRisksCount,
        affectedProducts
      }
    });
  } catch (error: any) {
    return handleServerError(res, error);
  }
});

export default router;
