/**
 * Seed script — creates initial admin + test employee.
 * Usage: npm run seed
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seed() {
  try {
    console.log('🌱 Seeding database...\n');

    // Admin
    const adminHash = await bcrypt.hash('admin123', 10);
    const adminResult = await db.query(
      `INSERT INTO employees (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id, email, name, role`,
      ['admin@outreach.local', adminHash, 'Admin', 'admin']
    );
    console.log('  ✅ Admin:    admin@outreach.local / admin123');

    // Test employee
    const empHash = await bcrypt.hash('employee123', 10);
    const empResult = await db.query(
      `INSERT INTO employees (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id, email, name, role`,
      ['employee@outreach.local', empHash, 'Сотрудник 1', 'employee']
    );
    console.log('  ✅ Employee: employee@outreach.local / employee123');

    console.log('\n  Готово! Эти логины можно использовать в расширении.');
    console.log('  Admin видит аналитику, Employee работает с лидами.\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
