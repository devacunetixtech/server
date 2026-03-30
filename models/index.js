import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────
// PRODUCT MODEL
// ─────────────────────────────────────────
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, min: 0, default: null },
  category: {
    type: String,
    required: true,
    enum: ['Living Room', 'Bedroom', 'Dining', 'Office', 'Outdoor', 'Lighting', 'Decor'],
  },
  material: { type: String, default: '' },
  dimensions: {
    width: String,
    height: String,
    depth: String,
    weight: String,
  },
  colors: [String],
  images: [{ url: String, publicId: String }],
  stock: { type: Number, required: true, min: 0, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  featured: { type: Boolean, default: false },
  bestseller: { type: Boolean, default: false },
  wishlistCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  tags: [String],
  seo: {
    metaTitle: String,
    metaDescription: String,
  },
}, { timestamps: true });

productSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, price: 1 });

export const Product = mongoose.model('Product', productSchema);

// ─────────────────────────────────────────
// ORDER MODEL
// ─────────────────────────────────────────
const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1 },
});

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, default: '' },
  },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  deliveryFee: { type: Number, required: true },
  total: { type: Number, required: true },
  deliveryLocation: { type: String, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  paymentReference: { type: String, default: '' },
  paymentVerifiedAt: { type: Date, default: null },
  estimatedDelivery: { type: Date, default: null },
  statusHistory: [{
    status: String,
    note: String,
    timestamp: { type: Date, default: Date.now },
  }],
  notes: { type: String, default: '' },
}, { timestamps: true });

// Auto-generate order ID: FUR-2026-000123
orderSchema.pre('save', async function (next) {
  if (!this.orderId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Order').countDocuments();
    this.orderId = `FUR-${year}-${String(count + 1).padStart(6, '0')}`;
  }
  if (this.isNew) {
    this.statusHistory.push({ status: this.status, note: 'Order placed' });
    // Estimated delivery: 5 working days
    const delivery = new Date();
    delivery.setDate(delivery.getDate() + 7);
    this.estimatedDelivery = delivery;
  }
  next();
});

orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = mongoose.model('Order', orderSchema);

// ─────────────────────────────────────────
// ADMIN MODEL
// ─────────────────────────────────────────
const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['superadmin', 'admin'], default: 'admin' },
  lastLogin: { type: Date, default: null },
}, { timestamps: true });

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

adminSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const Admin = mongoose.model('Admin', adminSchema);

// ─────────────────────────────────────────
// SETTINGS MODEL
// ─────────────────────────────────────────
const settingsSchema = new mongoose.Schema({
  storeName: { type: String, default: 'Arbor & Co.' },
  storeEmail: { type: String, default: 'hello@arborandco.com' },
  storePhone: { type: String, default: '+234 800 123 4567' },
  storeAddress: { type: String, default: '14 Admiralty Way, Lekki Phase 1, Lagos' },
  whatsappNumber: { type: String, default: '2348001234567' },
  deliveryFees: {
    type: Map,
    of: Number,
    default: {
      Lagos: 5000,
      Ibadan: 2000,
      Abuja: 7000,
      Ogun: 3000,
      'Port Harcourt': 8000,
      Kano: 10000,
      Enugu: 8000,
      Kaduna: 10000,
      Benin: 7000,
      Warri: 8000,
      Others: 10000,
    },
  },
  freeDeliveryThreshold: { type: Number, default: 200000 },
  lowStockThreshold: { type: Number, default: 5 },
  currency: { type: String, default: 'NGN' },
  socialLinks: {
    instagram: { type: String, default: '' },
    facebook: { type: String, default: '' },
    twitter: { type: String, default: '' },
  },
  metaDescription: { type: String, default: 'Premium handcrafted furniture for the modern Nigerian home.' },
}, { timestamps: true });

export const Settings = mongoose.model('Settings', settingsSchema);
