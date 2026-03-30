import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Product, Settings } from '../models/index.js';

const products = [
  {
    name: 'Heritage Dining Table',
    description: 'A statement piece built to gather generations. Crafted from solid teak with hand-rubbed oil finish, this 8-seater dining table features a distinctive herringbone inlay pattern. Its broad, sturdy legs and smooth surface make it as practical as it is beautiful.',
    price: 680000,
    discountPrice: null,
    category: 'Dining',
    material: 'Solid Teak',
    dimensions: { width: '220cm', height: '76cm', depth: '100cm', weight: '68kg' },
    colors: ['Natural Teak', 'Dark Walnut'],
    images: [{ url: 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800&q=80', publicId: 'seed-dining' }],
    stock: 6, featured: true, bestseller: false, rating: 5.0, reviewCount: 18,
    tags: ['dining table', 'teak', '8-seater', 'family dining'],
  },
  {
    name: 'Abuja Velvet Sofa',
    description: 'A three-seater sofa that redefines the art of relaxation. Premium Italian velvet upholstery sits atop a kiln-dried hardwood frame with reinforced pocket coil springs. The deep seat and high back provide exceptional lumbar support. Available in four curated colourways.',
    price: 650000,
    discountPrice: null,
    category: 'Living Room',
    material: 'Velvet & Hardwood',
    dimensions: { width: '220cm', height: '88cm', depth: '95cm', weight: '72kg' },
    colors: ['Deep Teal', 'Blush Rose', 'Midnight Navy', 'Ivory'],
    images: [{ url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80', publicId: 'seed-sofa' }],
    stock: 4, featured: true, bestseller: true, rating: 4.9, reviewCount: 62,
    tags: ['sofa', 'velvet', '3-seater', 'premium', 'living room'],
  },
  {
    name: 'Executive Standing Desk',
    description: 'Purpose-built for the modern professional. This height-adjustable standing desk features a solid mahogany surface, integrated cable management, and precision electric lift mechanism (65–125cm). Transforms any home office into a productive sanctuary.',
    price: 520000,
    discountPrice: null,
    category: 'Office',
    material: 'Solid Mahogany & Steel',
    dimensions: { width: '160cm', height: '65–125cm (adjustable)', depth: '80cm', weight: '54kg' },
    colors: ['Dark Mahogany', 'Light Oak'],
    images: [{ url: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&q=80', publicId: 'seed-desk' }],
    stock: 7, featured: false, bestseller: false, rating: 4.8, reviewCount: 24,
    tags: ['standing desk', 'height adjustable', 'home office', 'mahogany'],
  },
  {
    name: 'Lagos Rattan Daybed',
    description: 'Inspired by the lush verandas of coastal Lagos, this daybed combines hand-woven natural rattan with weather-resistant outdoor cushions. The structural steel inner frame ensures durability, while the woven rattan exterior brings organic warmth to any outdoor space.',
    price: 340000,
    discountPrice: null,
    category: 'Outdoor',
    material: 'Natural Rattan & Steel',
    dimensions: { width: '180cm', height: '80cm', depth: '90cm', weight: '18kg' },
    colors: ['Natural', 'Whitewash'],
    images: [{ url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=800&q=80', publicId: 'seed-daybed' }],
    stock: 5, featured: false, bestseller: true, rating: 4.6, reviewCount: 15,
    tags: ['daybed', 'rattan', 'outdoor', 'garden', 'veranda'],
  },
  {
    name: 'Summit Bookshelf',
    description: 'A statement shelving unit that celebrates curated living. Five open shelves in solid pine with a powder-coated matte black steel frame. Modular design allows for custom configurations to suit any wall. Perfect for books, art, plants, and treasured objects.',
    price: 185000,
    discountPrice: null,
    category: 'Office',
    material: 'Pine & Steel',
    dimensions: { width: '100cm', height: '200cm', depth: '35cm', weight: '32kg' },
    colors: ['Natural Pine / Black', 'Whitewash / Black'],
    images: [{ url: 'https://images.unsplash.com/photo-1594040226829-7f251ab46d80?w=800&q=80', publicId: 'seed-shelf' }],
    stock: 15, featured: false, bestseller: true, rating: 4.5, reviewCount: 38,
    tags: ['bookshelf', 'pine', 'steel', 'storage', 'office', 'modular'],
  },
  {
    name: 'Eko Side Table',
    description: 'Perfectly proportioned for life beside the sofa or bed. The Eko Side Table is turned from a single piece of solid iroko wood, then hand-finished with a protective beeswax polish. Its organic form and warm grain make it a beautiful companion to any upholstered piece.',
    price: 65000,
    discountPrice: null,
    category: 'Living Room',
    material: 'Solid Iroko',
    dimensions: { width: '45cm', height: '55cm', depth: '45cm', weight: '8kg' },
    colors: ['Natural Iroko', 'Ebonised'],
    images: [{ url: 'https://images.unsplash.com/photo-1528913775512-624d24b27b96?w=800&q=80', publicId: 'seed-sidetable' }],
    stock: 20, featured: false, bestseller: false, rating: 4.6, reviewCount: 22,
    tags: ['side table', 'iroko', 'turned wood', 'nightstand'],
  },
  {
    name: 'Wabi Dining Chair (Set of 2)',
    description: 'Wabi chairs bring quiet Japanese-inspired elegance to the Nigerian dining room. Each chair is handwoven with natural rush seating on an ash wood frame. Lightweight yet sturdy, they stack for storage. Sold as a set of two.',
    price: 140000,
    discountPrice: null,
    category: 'Dining',
    material: 'Ash Wood & Rush Weave',
    dimensions: { width: '46cm', height: '88cm', depth: '50cm', weight: '5kg each' },
    colors: ['Natural Ash', 'Smoked Oak'],
    images: [{ url: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=800&q=80', publicId: 'seed-dchair' }],
    stock: 18, featured: false, bestseller: true, rating: 4.7, reviewCount: 53,
    tags: ['dining chair', 'ash wood', 'woven seat', 'set of 2', 'dining'],
  },
  {
    name: 'Lekki Media Console',
    description: 'The Lekki Media Console brings order and elegance to the living room. Featuring three push-to-open cabinet doors hiding cable-managed storage and a central open shelf, it is crafted from white oak veneer with solid oak legs. Designed for Nigerian living room dimensions.',
    price: 310000,
    discountPrice: null,
    category: 'Living Room',
    material: 'White Oak Veneer & Solid Oak',
    dimensions: { width: '180cm', height: '55cm', depth: '42cm', weight: '36kg' },
    colors: ['White Oak', 'Smoked Oak'],
    images: [{ url: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800&q=80', publicId: 'seed-console' }],
    stock: 6, featured: false, bestseller: false, rating: 4.5, reviewCount: 17,
    tags: ['tv console', 'media unit', 'white oak', 'storage', 'living room'],
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    await Product.deleteMany({});
    console.log('🗑️  Cleared existing products');

    for (const p of products) {
      const slug = p.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      await Product.create({ ...p, slug });
    }

    console.log(`🌱 Seeded ${products.length} products`);

    // Seed settings if missing
    const settingsExist = await Settings.findOne();
    if (!settingsExist) {
      await Settings.create({});
      console.log('⚙️  Default settings created');
    }

    await mongoose.disconnect();
    console.log('✨ Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
}

seed();
