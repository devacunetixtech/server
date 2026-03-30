import jwt from 'jsonwebtoken';
import https from 'https';
import crypto from 'crypto';
import { Admin, Product, Order, Settings } from '../models/index.js';
import { cloudinary as _cloudinary } from '../config/cloudinary.js';
const cloudinaryV2 = _cloudinary.v2;
import { getDeliveryFee } from '../config/delivery.js';
import {
  sendOrderConfirmationToCustomer,
  sendOrderNotificationToAdmin,
  sendStatusUpdateEmail,
  sendContactEmailToAdmin,
} from '../services/emailService.js';

// ─────────────────────────────────────────
// ADMIN AUTH
// ─────────────────────────────────────────
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin || !(await admin.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  admin.lastLogin = new Date();
  await admin.save();

  const token = jwt.sign({ id: admin._id, email: admin.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.json({
    token,
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
};

export const seedAdmin = async (req, res) => {
  const exists = await Admin.findOne({ email: 'admin@arborandco.com' });
  if (exists) return res.status(400).json({ message: 'Admin already exists.' });

  const admin = await Admin.create({
    name: 'Arbor Admin',
    email: 'admin@arborandco.com',
    password: 'Admin@1234',
  });

  // Also seed settings if none exist
  const settingsExist = await Settings.findOne();
  if (!settingsExist) await Settings.create({});

  res.status(201).json({ message: 'Admin seeded.', email: admin.email });
};

// ─────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────
export const getProducts = async (req, res) => {
  const {
    category, material, featured, bestseller,
    minPrice, maxPrice, search, sort = 'newest',
    page = 1, limit = 12,
  } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (material) filter.material = { $regex: material, $options: 'i' };
  if (featured === 'true') filter.featured = true;
  if (bestseller === 'true') filter.bestseller = true;
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    'price-asc': { price: 1 },
    'price-desc': { price: -1 },
    popular: { reviewCount: -1 },
  };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter).sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  res.json({ products, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

export const getProduct = async (req, res) => {
  const { identifier } = req.params;
  const isObjectId = /^[a-f\d]{24}$/i.test(identifier);
  const product = isObjectId
    ? await Product.findById(identifier)
    : await Product.findOne({ slug: identifier });
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json(product);
};

export const createProduct = async (req, res) => {
  const data = JSON.parse(req.body.data || '{}');
  const images = (req.files || []).map(f => ({ url: f.path, publicId: f.filename }));

  const product = await Product.create({ ...data, images });
  res.status(201).json(product);
};

export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const data = JSON.parse(req.body.data || '{}');
  const newImages = (req.files || []).map(f => ({ url: f.path, publicId: f.filename }));

  const existingImages = data.existingImages || [];
  const images = [...existingImages, ...newImages];

  const product = await Product.findByIdAndUpdate(
    id,
    { ...data, images, slug: undefined },
    { new: true, runValidators: true }
  );
  if (!product) return res.status(404).json({ message: 'Product not found.' });
  res.json(product);
};

export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found.' });

  // Delete images from Cloudinary
  for (const img of product.images) {
    if (img.publicId) {
      try { await cloudinaryV2.uploader.destroy(img.publicId); } catch { }
    }
  }
  await product.deleteOne();
  res.json({ message: 'Product deleted.' });
};

// ─────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────
export const createOrder = async (req, res) => {
  const { customer, shippingAddress, items, deliveryLocation, paymentReference } = req.body;

  if (!customer?.name || !customer?.email || !customer?.phone) {
    return res.status(400).json({ message: 'Customer details are required.' });
  }
  if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.state) {
    return res.status(400).json({ message: 'Complete shipping address required.' });
  }
  if (!items?.length) return res.status(400).json({ message: 'No items in order.' });
  if (!deliveryLocation) return res.status(400).json({ message: 'Delivery location required.' });

  // Load settings for delivery fees
  const settings = await Settings.findOne();
  const feesMap = settings?.deliveryFees
    ? Object.fromEntries(settings.deliveryFees)
    : null;

  // Server-side delivery fee validation
  const correctFee = getDeliveryFee(deliveryLocation, feesMap);
  const freeThreshold = settings?.freeDeliveryThreshold || 200000;

  // Enrich items from DB (prevent price tampering)
  const enrichedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).json({ message: `Product ${item.productId} not found.` });
    if (product.stock < item.quantity) {
      return res.status(400).json({ message: `Insufficient stock for "${product.name}". Only ${product.stock} left.` });
    }

    const price = product.discountPrice || product.price;
    enrichedItems.push({
      product: product._id,
      name: product.name,
      price,
      image: product.images?.[0]?.url || '',
      quantity: item.quantity,
    });
    subtotal += price * item.quantity;
  }

  const deliveryFee = subtotal >= freeThreshold ? 0 : correctFee;
  const total = subtotal + deliveryFee;

  // Create order
  const order = await Order.create({
    customer,
    shippingAddress,
    items: enrichedItems,
    subtotal,
    deliveryFee,
    total,
    deliveryLocation,
    paymentReference: paymentReference || '',
    paymentStatus: paymentReference ? 'Pending' : 'Pending',
  });

  // Send emails (non-blocking)
  sendOrderConfirmationToCustomer(order).catch(console.error);
  sendOrderNotificationToAdmin(order).catch(console.error);

  res.status(201).json({ order, message: 'Order placed successfully.' });
};

export const trackOrder = async (req, res) => {
  const { orderId, email } = req.query;
  if (!orderId && !email) return res.status(400).json({ message: 'Provide orderId or email.' });

  if (orderId) {
    const order = await Order.findOne({ orderId: orderId.toUpperCase() });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    return res.json([order]);
  }

  const orders = await Order.find({ 'customer.email': email.toLowerCase() }).sort({ createdAt: -1 });
  if (!orders.length) return res.status(404).json({ message: 'No orders found for this email.' });
  res.json(orders);
};

// Save pending order before payment
export const createPendingOrder = async (req, res) => {
  const { customer, shippingAddress, items, deliveryLocation, paymentReference } = req.body;

  // Validate delivery fee server-side
  const settings = await Settings.findOne();
  const feesMap = settings?.deliveryFees ? Object.fromEntries(settings.deliveryFees) : null;
  const correctFee = getDeliveryFee(deliveryLocation, feesMap);
  const freeThreshold = settings?.freeDeliveryThreshold || 200000;

  // Enrich items
  const enrichedItems = [];
  let subtotal = 0;
  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).json({ message: `Product not found` });
    const price = product.discountPrice || product.price;
    enrichedItems.push({ product: product._id, name: product.name, price, image: product.images?.[0]?.url || '', quantity: item.quantity });
    subtotal += price * item.quantity;
  }

  const deliveryFee = subtotal >= freeThreshold ? 0 : correctFee;
  const total = subtotal + deliveryFee;

  // Save as pending (paymentStatus: Pending)
  const order = await Order.create({
    customer, shippingAddress, items: enrichedItems,
    subtotal, deliveryFee, total, deliveryLocation,
    paymentReference, paymentStatus: 'Pending', status: 'Pending'
  });

  res.status(201).json({ order, message: 'Pending order created' });
};

// Recover order by payment reference
export const recoverOrder = async (req, res) => {
  const order = await Order.findOne({ paymentReference: req.params.reference });
  if (!order) return res.status(404).json({ message: 'No order found for this reference' });
  res.json(order);
};

export const getOrderById = async (req, res) => {
  const order = await Order.findOne({
    $or: [{ _id: req.params.id }, { orderId: req.params.id }]
  });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json(order);
};

// ─────────────────────────────────────────
// ADMIN — ORDERS
// ─────────────────────────────────────────
export const getAdminOrders = async (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  const filter = {};
  if (status && status !== 'All') filter.status = status;
  if (search) {
    filter.$or = [
      { orderId: { $regex: search, $options: 'i' } },
      { 'customer.name': { $regex: search, $options: 'i' } },
      { 'customer.email': { $regex: search, $options: 'i' } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
};

export const getAdminOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate('items.product', 'name images slug');
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json(order);
};

export const updateOrderStatus = async (req, res) => {
  const { status, note } = req.body;
  const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status.' });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });

  // Restore stock if cancelling
  if (status === 'Cancelled' && order.status !== 'Cancelled') {
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
    }
  }

  order.status = status;
  order.statusHistory.push({ status, note: note || '' });
  await order.save();

  sendStatusUpdateEmail(order).catch(console.error);
  res.json(order);
};

// ─────────────────────────────────────────
// ADMIN — DASHBOARD
// ─────────────────────────────────────────
export const getDashboardStats = async (req, res) => {
  const settings = await Settings.findOne();
  const threshold = settings?.lowStockThreshold || 5;

  const [
    totalOrders, revenue, totalProducts, lowStockProducts,
    ordersByStatus, recentOrders,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]),
    Product.countDocuments(),
    Product.find({ stock: { $lte: threshold } }).select('name category stock images').limit(10),
    Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Order.find().sort({ createdAt: -1 }).limit(8).select('orderId customer total status createdAt'),
  ]);

  const statusMap = {};
  ordersByStatus.forEach(s => { statusMap[s._id] = s.count; });

  res.json({
    totalOrders,
    revenue: revenue[0]?.total || 0,
    totalProducts,
    lowStockProducts,
    ordersByStatus: statusMap,
    recentOrders,
  });
};

// ─────────────────────────────────────────
// ADMIN — CUSTOMERS
// ─────────────────────────────────────────
export const getCustomers = async (req, res) => {
  const customers = await Order.aggregate([
    {
      $group: {
        _id: '$customer.email',
        name: { $last: '$customer.name' },
        email: { $last: '$customer.email' },
        phone: { $last: '$customer.phone' },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        lastOrder: { $max: '$createdAt' },
      }
    },
    { $sort: { lastOrder: -1 } },
  ]);
  res.json(customers);
};

export const getCustomerOrders = async (req, res) => {
  const orders = await Order.find({ 'customer.email': req.params.email.toLowerCase() })
    .sort({ createdAt: -1 });
  res.json(orders);
};

// ─────────────────────────────────────────
// ADMIN — SETTINGS
// ─────────────────────────────────────────
export const getSettings = async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  // Convert Map to plain object for JSON
  const plain = settings.toObject();
  plain.deliveryFees = Object.fromEntries(settings.deliveryFees || new Map());
  res.json(plain);
};

export const updateSettings = async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = new Settings();

  const { deliveryFees, ...rest } = req.body;
  Object.assign(settings, rest);
  if (deliveryFees) {
    settings.deliveryFees = new Map(Object.entries(deliveryFees));
  }
  await settings.save();

  const plain = settings.toObject();
  plain.deliveryFees = Object.fromEntries(settings.deliveryFees || new Map());
  res.json(plain);
};

// ─────────────────────────────────────────
// PAYMENT — PAYSTACK
// ─────────────────────────────────────────
const paystackRequest = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.paystack.co',
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Failed to parse Paystack response')); }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

export const initializePayment = async (req, res) => {
  const { email, amount, orderId, callbackUrl } = req.body;
  if (!email || !amount) return res.status(400).json({ message: 'Email and amount required.' });

  // TEST KEY
  const payload = {
    email,
    amount: Math.round(amount * 100), // kobo
    reference: `ARB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    callback_url: callbackUrl || `${process.env.CLIENT_URL}/order-confirmation`,
    metadata: { orderId, custom_fields: [{ display_name: 'Order ID', variable_name: 'order_id', value: orderId }] },
  };

  // LIVE KEY: uncomment and use process.env.PAYSTACK_SECRET_KEY (set to sk_live_xxx in .env)
  // The paystackRequest function automatically uses whatever key is in PAYSTACK_SECRET_KEY

  const data = await paystackRequest('POST', '/transaction/initialize', payload);
  res.json(data);
};

export const verifyPayment = async (req, res) => {
  const { reference } = req.params;
  const data = await paystackRequest('GET', `/transaction/verify/${reference}`);

  if (data.data?.status === 'success') {
    const order = await Order.findOneAndUpdate(
      { paymentReference: reference, paymentStatus: 'Pending' },
      {
        paymentStatus: 'Paid',
        paymentVerifiedAt: new Date(),
        status: 'Processing',
        $push: { statusHistory: { status: 'Processing', note: 'Payment confirmed via verification' } }
      },
      { new: true }
    );
    if (order) {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
      }
      sendOrderConfirmationToCustomer(order).catch(console.error);
      sendOrderNotificationToAdmin(order).catch(console.error);
    }
  }

  res.json(data);
};

export const paystackWebhook = async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.success') {
  const order = await Order.findOneAndUpdate(
    { paymentReference: data.reference, paymentStatus: 'Pending' },
    {
      paymentStatus: 'Paid',
      paymentVerifiedAt: new Date(),
      status: 'Processing',
      $push: { statusHistory: { status: 'Processing', note: 'Payment confirmed via webhook' } }
    },
    { new: true }
  );

  if (order) {
    // ✅ Only decrement stock after confirmed payment
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity }
      });
    }
    sendOrderConfirmationToCustomer(order).catch(console.error);
    sendOrderNotificationToAdmin(order).catch(console.error);
  }
}

  res.sendStatus(200);
};

// ─────────────────────────────────────────
// DELIVERY FEES (public endpoint)
// ─────────────────────────────────────────
export const getDeliveryFees = async (req, res) => {
  const settings = await Settings.findOne();
  const fees = settings?.deliveryFees
    ? Object.fromEntries(settings.deliveryFees)
    : null;

  const { DEFAULT_DELIVERY_FEES, FREE_DELIVERY_THRESHOLD } = await import('../config/delivery.js');
  res.json({
    fees: fees || DEFAULT_DELIVERY_FEES,
    freeThreshold: settings?.freeDeliveryThreshold || FREE_DELIVERY_THRESHOLD,
  });
};

// ─────────────────────────────────────────
// CONTACT FORM
// ─────────────────────────────────────────
export const submitContactForm = async (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    await sendContactEmailToAdmin({ name, email, subject, message });
    res.json({ message: "Message sent! We'll respond within 24 hours." });
  } catch (err) {
    console.error('Contact email error:', err);
    res.status(500).json({ message: 'Failed to send message. Please try again later.' });
  }
};