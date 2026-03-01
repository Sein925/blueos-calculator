const { Pool } = require('pg')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  }
  return pool
}

async function query(text, params) {
  const start = Date.now()
  try {
    const res = await getPool().query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (err) {
    console.error('Database query error', { text, err })
    throw err
  }
}

async function initTables() {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL UNIQUE,
      is_paid BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createOrdersTable = `
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL UNIQUE,
      device_id VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      pay_type VARCHAR(20),
      trade_no VARCHAR(128),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `

  const createOrderNoIndex = `
    CREATE INDEX IF NOT EXISTS idx_order_no ON orders(order_no)
  `

  const createDeviceIdIndex = `
    CREATE INDEX IF NOT EXISTS idx_device_id ON orders(device_id)
  `

  try {
    await query(createUsersTable)
    await query(createOrdersTable)
    await query(createOrderNoIndex)
    await query(createDeviceIdIndex)
    console.log('Tables initialized successfully')
  } catch (err) {
    console.error('Error initializing tables:', err)
  }
}

module.exports = {
  query,
  initTables,
  getPool
}
