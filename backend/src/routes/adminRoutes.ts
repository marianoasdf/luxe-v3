import { Router, Request, Response, NextFunction } from 'express';
import {
  revokeAllRefreshTokensGlobal,
  incrementTokenVersionAll,
  revokeAllRefreshTokensForUser,
  incrementTokenVersion,
} from '../models/User';
import {
  adminListProducts,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminDeleteProduct,
  adminListVariantsHandler as adminListVariants,
  adminCreateVariantHandler as adminCreateVariant,
  adminUpdateVariantHandler as adminUpdateVariant,
  adminDeleteVariantHandler as adminDeleteVariant,
} from '../controllers/productController';
import { getSignature } from '../controllers/cloudinaryController';
import { adminListOrders, adminGetOrder } from '../controllers/shippingController';
import { adminUpdateOrderStatus } from '../controllers/orderController';
import { adminUpdateTransferDiscount } from '../controllers/settingsController';

const router = Router();

function adminCheck(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = req.headers['x-admin-secret'];
  const secret = Array.isArray(adminSecret) ? adminSecret[0] : adminSecret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: 'Admin secret inválido' });
    return;
  }
  next();
}

router.post('/admin/logout-all', adminCheck, async (req: Request, res: Response) => {
  try {
    const deleted = await revokeAllRefreshTokensGlobal();
    const rows = await incrementTokenVersionAll();
    res.json({ message: 'Todas las sesiones globalmente revocadas', revoked_count: deleted, users_updated: rows.length });
  } catch (err) {
    console.error('admin logout all error', err);
    res.status(500).json({ error: 'Error en admin logout all' });
  }
});

router.post('/admin/users/:id/logout', adminCheck, async (req: Request, res: Response) => {
  try {
    const targetId = parseInt(String(req.params.id));
    if (!targetId) {
      res.status(400).json({ error: 'User id inválido' });
      return;
    }
    await revokeAllRefreshTokensForUser(targetId);
    const newVersion = await incrementTokenVersion(targetId);
    res.json({ message: 'Sesiones del usuario revocadas', token_version: newVersion });
  } catch (err) {
    console.error('admin logout user error', err);
    res.status(500).json({ error: 'Error en admin logout user' });
  }
});

// Admin Productos CRUD
router.get('/admin/products', adminCheck, adminListProducts);
router.get('/admin/products/:id', adminCheck, adminGetProduct);
router.post('/admin/products', adminCheck, adminCreateProduct);
router.put('/admin/products/:id', adminCheck, adminUpdateProduct);
router.delete('/admin/products/:id', adminCheck, adminDeleteProduct);

// Admin Variantes CRUD
router.get('/admin/products/:productId/variants', adminCheck, adminListVariants);
router.post('/admin/products/:productId/variants', adminCheck, adminCreateVariant);
router.put('/admin/variants/:variantId', adminCheck, adminUpdateVariant);
router.delete('/admin/variants/:variantId', adminCheck, adminDeleteVariant);

// Cloudinary firma para uploads
router.post('/admin/cloudinary/signature', adminCheck, getSignature);

// Admin Envios / Ordenes
router.get('/admin/orders', adminCheck, adminListOrders);
router.get('/admin/orders/:id', adminCheck, adminGetOrder);
router.put('/admin/orders/:id/status', adminCheck, adminUpdateOrderStatus);

// Configuración de la tienda
router.put('/admin/settings/transfer-discount', adminCheck, adminUpdateTransferDiscount);

export default router;

