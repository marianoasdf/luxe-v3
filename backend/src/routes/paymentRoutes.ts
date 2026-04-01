import { Router } from 'express';
import { createPreference, createPayment, webhookMercadoPago, getOrder, listOrders } from '../controllers/paymentController';
import { quoteShipping } from '../controllers/shippingController';

const router = Router();

router.post('/payments/preference', createPreference);
router.post('/payments/charge', createPayment);
router.post('/shipping/quote', quoteShipping);
router.post('/webhooks/mercadopago', webhookMercadoPago);
router.get('/orders/:id', getOrder);
router.get('/orders', listOrders);

export default router;
