import { Router, Request, Response } from 'express';
import { getProducts, getProductDetail, getVariants } from '../controllers/productController';

const router = Router();

router.get('/_ping', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.get('/products', getProducts);
router.get('/products/:slug', getProductDetail);
router.get('/products/:id/variants', getVariants);

export default router;
