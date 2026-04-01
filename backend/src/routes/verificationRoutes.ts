import { Router } from 'express';
import { verifyEmail, resendVerification } from '../controllers/verificationController';

const router = Router();

router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

export default router;
