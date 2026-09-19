// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

console.log('📡 Connecting to database...');

// Create a PostgreSQL connection pool
// Render's *external* Postgres endpoint (the one reachable from outside
// Render's own network, e.g. this script running on a local machine)
// requires SSL. Without this, the initial handshake can still succeed but
// the connection gets closed by the server as soon as a real
// transaction starts — which shows up as a confusing P1017
// "ConnectionClosed" error deep inside the Prisma adapter.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    /@(localhost|127\.0\.0\.1|postgres):/.test(process.env.DATABASE_URL || '')
      ? false
      : { rejectUnauthorized: false },
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
    // This script seeds well-known test accounts (admin@malaki.com / admin123,
    // and customerN@email.com / customer123) — never run it against a real
    // production database. Set ALLOW_PROD_SEED=true only if you fully intend
    // to do this and will rotate the admin password immediately after.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
      console.error(
        "❌ Refusing to run: NODE_ENV=production and ALLOW_PROD_SEED is not set to 'true'.\n" +
          "   This script creates a well-known admin/test password — it must not run against production."
      );
      process.exit(1);
    }

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


    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Summary:');
    console.log(`  👤 Users: 4 (1 Admin, 3 Customers)`);
    console.log(`  📍 Addresses: 3`);
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
