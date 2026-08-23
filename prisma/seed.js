// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log('📡 Connecting to database...');

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create the Prisma adapter
const adapter = new PrismaPg(pool);

// Initialize Prisma Client with the adapter
const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'],
});

// ─── Main seeding function ──────────────────────────────────────────────────

async function main() {
  try {
    // Test connection first
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully\n');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }

    console.log('🌱 Starting database seeding...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ─── 1. Create Admin User ──────────────────────────────────────────────
    console.log('👤 Creating admin user...');
    
    const adminPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@malaki.com' },
      update: {},
      create: {
        email: 'admin@malaki.com',
        passwordHash: adminPassword,
        firstName: 'Admin',
        lastName: 'Malaki',
        role: 'ADMIN',
        isVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Admin created:', admin.email);

    // ─── 2. Create Customer Users ──────────────────────────────────────────
    console.log('👤 Creating customer users...');
    
    const customerPassword = await bcrypt.hash('customer123', 10);
    
    const customer1 = await prisma.user.upsert({
      where: { email: 'ahmed@email.com' },
      update: {},
      create: {
        email: 'ahmed@email.com',
        passwordHash: customerPassword,
        firstName: 'Ahmed',
        lastName: 'Mohammed',
        phone: '+974 1234 5678',
        role: 'CUSTOMER',
        isVerified: true,
        isActive: true,
      },
    });

    const customer2 = await prisma.user.upsert({
      where: { email: 'fatima@email.com' },
      update: {},
      create: {
        email: 'fatima@email.com',
        passwordHash: customerPassword,
        firstName: 'Fatima',
        lastName: 'Ali',
        phone: '+974 8765 4321',
        role: 'CUSTOMER',
        isVerified: true,
        isActive: true,
      },
    });

    const customer3 = await prisma.user.upsert({
      where: { email: 'khalid@email.com' },
      update: {},
      create: {
        email: 'khalid@email.com',
        passwordHash: customerPassword,
        firstName: 'Khalid',
        lastName: 'Saeed',
        phone: '+974 5555 5555',
        role: 'CUSTOMER',
        isVerified: true,
        isActive: true,
      },
    });
    console.log(`✅ ${[customer1, customer2, customer3].length} customers created`);

    // ─── 3. Create Categories ──────────────────────────────────────────────
    console.log('📂 Creating categories...');
    
    await prisma.category.createMany({
      data: [
        { name: 'Fresh Vegetables', nameAr: 'الخضروات الطازجة', slug: 'vegetables', icon: '🥦', isActive: true, sortOrder: 1 },
        { name: 'Fresh Fruits', nameAr: 'الفواكه الطازجة', slug: 'fruits', icon: '🍎', isActive: true, sortOrder: 2 },
        { name: 'Dates & Nuts', nameAr: 'التمور والمكسرات', slug: 'dates-nuts', icon: '🌴', isActive: true, sortOrder: 3 },
        { name: 'Fresh Juices', nameAr: 'العصائر الطازجة', slug: 'juices', icon: '🧃', isActive: true, sortOrder: 4 },
        { name: 'Local Products', nameAr: 'المنتجات المحلية', slug: 'local-products', icon: '🌿', isActive: true, sortOrder: 5 },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Categories created');

    // ─── 4. Get Category IDs ──────────────────────────────────────────────
    const categories = await prisma.category.findMany({
      where: { isActive: true },
    });
    
    const vegCategory = categories.find(c => c.slug === 'vegetables');
    const fruitsCategory = categories.find(c => c.slug === 'fruits');
    const datesCategory = categories.find(c => c.slug === 'dates-nuts');
    const juicesCategory = categories.find(c => c.slug === 'juices');
    const localCategory = categories.find(c => c.slug === 'local-products');

    if (!vegCategory || !fruitsCategory || !datesCategory || !juicesCategory || !localCategory) {
      throw new Error('Some categories not found');
    }

    // ─── 5. Create Products ────────────────────────────────────────────────
    console.log('📦 Creating products...');

    const productsData = [
      // Vegetables
      { name: 'Tomatoes', nameAr: 'طماطم', slug: 'tomatoes', categoryId: vegCategory.id, price: 5.5, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 100, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=400', isActive: true },
      { name: 'Cucumber', nameAr: 'خيار', slug: 'cucumber', categoryId: vegCategory.id, price: 4.25, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 80, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=400', isActive: true },
      { name: 'Potatoes', nameAr: 'بطاطس', slug: 'potatoes', categoryId: vegCategory.id, price: 3.75, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 120, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=400', isActive: true },
      { name: 'Onions', nameAr: 'بصل', slug: 'onions', categoryId: vegCategory.id, price: 3.25, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 90, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=400', isActive: true },
      // Fruits
      { name: 'Orange', nameAr: 'برتقال عصير', slug: 'orange', categoryId: fruitsCategory.id, price: 4.75, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 70, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400', isActive: true },
      { name: 'Banana', nameAr: 'موز', slug: 'banana', categoryId: fruitsCategory.id, price: 4.5, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 60, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400', isActive: true },
      { name: 'Red Apple', nameAr: 'تفاح أحمر', slug: 'red-apple', categoryId: fruitsCategory.id, price: 6.5, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 50, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400', isActive: true },
      { name: 'White Grapes', nameAr: 'عنب أبيض', slug: 'white-grapes', categoryId: fruitsCategory.id, price: 8.75, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 40, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1599819177626-ca3b5d4e1a2e?w=400', isActive: true },
      // Dates & Nuts
      { name: 'Khalas Dates', nameAr: 'تمر خلاص', slug: 'khalas-dates', categoryId: datesCategory.id, price: 12.5, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 30, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1593904308074-e1a6c0debb27?w=400', isActive: true },
      { name: 'Mixed Nuts', nameAr: 'مكسرات مشكلة', slug: 'mixed-nuts', categoryId: datesCategory.id, price: 16.75, unitLabel: '1 كيلو', isFresh: true, inStock: true, stockQuantity: 25, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400', isActive: true },
      // Juices
      { name: 'Fresh Orange Juice', nameAr: 'عصير برتقال طازج', slug: 'fresh-orange-juice', categoryId: juicesCategory.id, price: 9.5, unitLabel: '1 لتر', isFresh: true, inStock: true, stockQuantity: 20, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400', isActive: true },
      // Local
      { name: 'Local Lettuce', nameAr: 'خس بلدي', slug: 'local-lettuce', categoryId: localCategory.id, price: 3.0, unitLabel: '1 حبة', isFresh: true, inStock: true, stockQuantity: 45, brand: 'الملكي', imageUrl: 'https://images.unsplash.com/photo-1622206151226-18ca2c9d680f?w=400', isActive: true },
    ];

    // Create products one by one to avoid duplicate slug issues
    for (const productData of productsData) {
      try {
        await prisma.product.upsert({
          where: { slug: productData.slug },
          update: productData,
          create: productData,
        });
      } catch (error) {
        console.log(`  ⚠️ Product ${productData.slug} already exists, skipping...`);
      }
    }
    console.log(`✅ ${productsData.length} products created`);

    // ─── 6. Create Addresses for Customers ──────────────────────────────────
    console.log('📍 Creating customer addresses...');
    
    await prisma.userAddress.createMany({
      data: [
        {
          userId: customer1.id,
          addressLine1: 'Al Sadd Street',
          addressLine2: 'Building 123, Apt 4B',
          city: 'Doha',
          country: 'Qatar',
          postalCode: '00000',
          isDefault: true,
          addressType: 'HOME',
        },
        {
          userId: customer2.id,
          addressLine1: 'West Bay',
          addressLine2: 'Tower 5, Floor 12',
          city: 'Doha',
          country: 'Qatar',
          postalCode: '00000',
          isDefault: true,
          addressType: 'HOME',
        },
        {
          userId: customer3.id,
          addressLine1: 'Al Wakrah',
          addressLine2: 'Street 10, Villa 8',
          city: 'Al Wakrah',
          country: 'Qatar',
          postalCode: '00000',
          isDefault: true,
          addressType: 'HOME',
        },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Addresses created');

    // ─── 7. Create Cart for Customer (FIXED) ──────────────────────────────
    console.log('🛒 Creating cart for customer...');
    
    // First check if cart exists
    let cart = await prisma.cart.findFirst({
      where: { userId: customer1.id },
    });

    if (!cart) {
      // Create cart if it doesn't exist
      cart = await prisma.cart.create({
        data: {
          userId: customer1.id,
        },
      });
      console.log('✅ Cart created');
    } else {
      console.log('✅ Cart already exists');
    }

    // Get products to add to cart
    const tomato = await prisma.product.findFirst({ where: { slug: 'tomatoes' } });
    const orange = await prisma.product.findFirst({ where: { slug: 'orange' } });
    const banana = await prisma.product.findFirst({ where: { slug: 'banana' } });

    if (tomato && orange && banana) {
      // Check if items already exist
      const existingItems = await prisma.cartItem.findMany({
        where: { cartId: cart.id },
      });

      if (existingItems.length === 0) {
        await prisma.cartItem.createMany({
          data: [
            { cartId: cart.id, productId: tomato.id, quantity: 2, unitPrice: tomato.price },
            { cartId: cart.id, productId: orange.id, quantity: 3, unitPrice: orange.price },
            { cartId: cart.id, productId: banana.id, quantity: 1, unitPrice: banana.price },
          ],
        });
        console.log('✅ Cart items added');
      } else {
        console.log('✅ Cart items already exist');
      }
    }

    // ─── 8. Create Sample Orders ──────────────────────────────────────────
    console.log('📦 Creating sample orders...');

    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 5,
    });

    if (products.length > 0) {
      // Check if orders already exist
      const existingOrders = await prisma.order.count({
        where: { userId: customer1.id },
      });

      if (existingOrders === 0) {
        // Order 1 - Delivered
        await prisma.order.create({
          data: {
            orderNumber: `ORD-${Date.now().toString().slice(-8)}-001`,
            userId: customer1.id,
            customerEmail: customer1.email,
            customerPhone: customer1.phone || '+974 1234 5678',
            status: 'DELIVERED',
            paymentStatus: 'PAID',
            paymentMethod: 'CASH',
            subtotal: 15.5,
            discountAmount: 0,
            taxAmount: 0,
            deliveryFee: 10,
            totalAmount: 25.5,
            deliveryAddress: {
              fullName: 'Ahmed Mohammed',
              phone: '+974 1234 5678',
              address: 'Al Sadd Street, Building 123, Apt 4B',
              city: 'Doha',
            },
            estimatedDeliveryTime: new Date(Date.now() - 86400000),
            actualDeliveryTime: new Date(Date.now() - 43200000),
            items: {
              create: [
                { productId: products[0].id, productName: products[0].name, productNameAr: products[0].nameAr, unitPrice: products[0].price, quantity: 1 },
                { productId: products[1].id, productName: products[1].name, productNameAr: products[1].nameAr, unitPrice: products[1].price, quantity: 2 },
              ],
            },
            statusHistory: {
              create: [
                { status: 'PENDING', notes: 'Order placed' },
                { status: 'CONFIRMED', notes: 'Order confirmed by admin' },
                { status: 'PREPARING', notes: 'Preparing your order' },
                { status: 'READY', notes: 'Order ready for delivery' },
                { status: 'DELIVERING', notes: 'Out for delivery' },
                { status: 'DELIVERED', notes: 'Order delivered successfully' },
              ],
            },
          },
        });
        console.log('✅ Sample order 1 created (Delivered)');

        // Order 2 - Pending
        await prisma.order.create({
          data: {
            orderNumber: `ORD-${Date.now().toString().slice(-8)}-002`,
            userId: customer2.id,
            customerEmail: customer2.email,
            customerPhone: customer2.phone || '+974 8765 4321',
            status: 'PENDING',
            paymentStatus: 'PENDING',
            paymentMethod: 'CARD',
            subtotal: 12.75,
            discountAmount: 0,
            taxAmount: 0,
            deliveryFee: 10,
            totalAmount: 22.75,
            deliveryAddress: {
              fullName: 'Fatima Ali',
              phone: '+974 8765 4321',
              address: 'West Bay, Tower 5, Floor 12',
              city: 'Doha',
            },
            estimatedDeliveryTime: new Date(Date.now() + 3600000),
            items: {
              create: [
                { productId: products[2].id, productName: products[2].name, productNameAr: products[2].nameAr, unitPrice: products[2].price, quantity: 1 },
                { productId: products[3].id, productName: products[3].name, productNameAr: products[3].nameAr, unitPrice: products[3].price, quantity: 1 },
              ],
            },
            statusHistory: {
              create: [{ status: 'PENDING', notes: 'Order placed' }],
            },
          },
        });
        console.log('✅ Sample order 2 created (Pending)');

        // Order 3 - Confirmed
        await prisma.order.create({
          data: {
            orderNumber: `ORD-${Date.now().toString().slice(-8)}-003`,
            userId: customer1.id,
            customerEmail: customer1.email,
            customerPhone: customer1.phone || '+974 1234 5678',
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            paymentMethod: 'WALLET',
            subtotal: 9.5,
            discountAmount: 0,
            taxAmount: 0,
            deliveryFee: 10,
            totalAmount: 19.5,
            deliveryAddress: {
              fullName: 'Ahmed Mohammed',
              phone: '+974 1234 5678',
              address: 'Al Sadd Street, Building 123, Apt 4B',
              city: 'Doha',
            },
            estimatedDeliveryTime: new Date(Date.now() + 7200000),
            items: {
              create: [
                { productId: products[4].id, productName: products[4].name, productNameAr: products[4].nameAr, unitPrice: products[4].price, quantity: 1 },
              ],
            },
            statusHistory: {
              create: [
                { status: 'PENDING', notes: 'Order placed' },
                { status: 'CONFIRMED', notes: 'Order confirmed by admin' },
              ],
            },
          },
        });
        console.log('✅ Sample order 3 created (Confirmed)');
      } else {
        console.log('✅ Orders already exist');
      }
    }

    // ─── 9. Create Wishlist items ──────────────────────────────────────────
    console.log('⭐ Creating wishlist items...');
    
    const wishlistProducts = await prisma.product.findMany({
      where: { isActive: true },
      take: 3,
      skip: 2,
    });

    if (wishlistProducts.length > 0) {
      let wishlistCount = 0;
      for (const product of wishlistProducts) {
        try {
          await prisma.wishlist.upsert({
            where: {
              userId_productId: {
                userId: customer1.id,
                productId: product.id,
              },
            },
            update: {},
            create: {
              userId: customer1.id,
              productId: product.id,
            },
          });
          wishlistCount++;
        } catch (error) {
          // Skip if already exists
        }
      }
      console.log(`✅ ${wishlistCount} wishlist items added`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`  👤 Users: 4 (1 Admin, 3 Customers)`);
    console.log(`  📂 Categories: 5`);
    console.log(`  📦 Products: 12`);
    console.log(`  📍 Addresses: 3`);
    console.log(`  🛒 Cart: 1 (with 3 items)`);
    console.log(`  📦 Orders: 3 (Delivered, Pending, Confirmed)`);
    console.log('\n🔐 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 Admin:');
    console.log('  📧 admin@malaki.com');
    console.log('  🔑 admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Customers:');
    console.log('  📧 ahmed@email.com  🔑 customer123');
    console.log('  📧 fatima@email.com  🔑 customer123');
    console.log('  📧 khalid@email.com  🔑 customer123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  });