import express from 'express';
import { upload } from '../config/cloudinary.js';
import { protect } from '../middleware/auth.js';
import {
  // Auth
  adminLogin, seedAdmin,
  // Products
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  // Orders (public)
  createOrder, trackOrder, getOrderById, createPendingOrder, recoverOrder,
  // Admin orders
  getAdminOrders, getAdminOrderById, updateOrderStatus,
  // Dashboard
  getDashboardStats,
  // Customers
  getCustomers, getCustomerOrders,
  // Settings
  getSettings, updateSettings,
  // Payment
  initializePayment, verifyPayment, paystackWebhook,
  // Delivery
  getDeliveryFees,
  // Contact
  submitContactForm,
} from '../controllers/index.js';

const router = express.Router();

// ─── AUTH ────────────────────────────────
router.post('/admin/login', adminLogin);
router.post('/admin/seed', seedAdmin); // Remove in production

// ─── PRODUCTS (public) ───────────────────
router.get('/products', getProducts);
router.get('/products/:identifier', getProduct);

// ─── PRODUCTS (admin) ────────────────────
router.post('/products', protect, upload.array('images', 10), createProduct);
router.put('/products/:id', protect, upload.array('images', 10), updateProduct);
router.delete('/products/:id', protect, deleteProduct);

// ─── ORDERS (public) ─────────────────────
router.post('/orders', createOrder);
router.get('/orders/track', trackOrder);
router.get('/orders/:id', getOrderById);
router.post('/orders/pending', createPendingOrder);
router.get('/orders/recover/:reference', recoverOrder);

// ─── ADMIN ORDERS ────────────────────────
router.get('/admin/orders', protect, getAdminOrders);
router.get('/admin/orders/:id', protect, getAdminOrderById);
router.put('/admin/orders/:id/status', protect, updateOrderStatus);

// ─── ADMIN DASHBOARD ─────────────────────
router.get('/admin/dashboard', protect, getDashboardStats);

// ─── ADMIN CUSTOMERS ─────────────────────
router.get('/admin/customers', protect, getCustomers);
router.get('/admin/customers/:email/orders', protect, getCustomerOrders);

// ─── ADMIN SETTINGS ──────────────────────
router.get('/admin/settings', protect, getSettings);
router.put('/admin/settings', protect, updateSettings);

// ─── PAYMENT ─────────────────────────────
// Webhook must use raw body - handled in index.js before JSON parse
router.post('/payment/webhook', paystackWebhook);
router.post('/payment/initialize', initializePayment);
router.get('/payment/verify/:reference', verifyPayment);

// ─── DELIVERY FEES (public) ──────────────
router.get('/delivery-fees', getDeliveryFees);

// ─── CONTACT (public) ────────────────────
router.post('/contact', submitContactForm);

export default router;
