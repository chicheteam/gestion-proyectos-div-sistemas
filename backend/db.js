const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configure node-oracledb to fetch CLOBs as strings automatically
oracledb.fetchAsString = [ oracledb.CLOB ];

// Thin mode is default in v6+, no Instant Client required. Do NOT call initOracleClient()

const config = {
  user: process.env.DB_USER || 'SYSTEM',
  password: process.env.DB_PASSWORD || 'oracle_password',
  connectString: process.env.DB_CONNECT_STRING || 'oracle-db:1521/FREEPDB1',
  poolMin: 2,
  poolMax: 10,
  poolIncrement: 1,
  poolTimeout: 60
};

let pool;

async function initializeDatabase() {
  const maxRetries = 15;
  const retryInterval = 5000; // 5 seconds
  let retries = 0;

  console.log('Connecting to Oracle Database at:', config.connectString);

  while (retries < maxRetries) {
    try {
      pool = await oracledb.createPool(config);
      console.log('Successfully connected to Oracle Database Pool.');
      await runSchemaInitialization();
      return;
    } catch (err) {
      retries++;
      console.error(`Database connection failed (Attempt ${retries}/${maxRetries}):`, err.message);
      if (retries === maxRetries) {
        throw new Error('Could not connect to Oracle Database. Max retries exceeded.');
      }
      console.log(`Waiting ${retryInterval / 1000} seconds before retrying...`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
}

async function execute(sql, binds = [], options = {}) {
  // Convert undefined to null to prevent NJS-044 errors from oracledb
  if (Array.isArray(binds)) {
    binds = binds.map(b => b === undefined ? null : b);
  } else if (typeof binds === 'object' && binds !== null) {
    const newBinds = {};
    for (const [k, v] of Object.entries(binds)) {
      if (v && typeof v === 'object' && 'val' in v) {
        newBinds[k] = { ...v, val: v.val === undefined ? null : v.val };
      } else {
        newBinds[k] = v === undefined ? null : v;
      }
    }
    binds = newBinds;
  }

  let connection;
  const opts = {
    autoCommit: true,
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    ...options
  };

  try {
    connection = await pool.getConnection();
    const result = await connection.execute(sql, binds, opts);
    return result;
  } catch (err) {
    console.error('SQL Execution Error:', err);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }
  }
}

async function runSchemaInitialization() {
  try {
    // Check if table EQUIPO exists
    const checkTable = await execute(`
      SELECT table_name FROM user_tables WHERE table_name = 'PROYECTOS'
    `);

    if (checkTable.rows && checkTable.rows.length > 0) {
      console.log('Database tables already exist. Skipping schema initialization.');
      return;
    }

    console.log('Initializing database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Oracle doesn't support multiple statements in a single execution via driver easily,
    // so we split by semicolon (ignoring comments)
    const statements = schemaSql
      .split('\n')
      // Remove SQL comment lines
      .filter(line => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      console.log('Executing DDL statement:', statement.substring(0, 50) + '...');
      await execute(statement);
    }
    console.log('Schema initialized successfully!');
  } catch (err) {
    console.error('Error during schema initialization:', err);
  }
}

module.exports = {
  initializeDatabase,
  execute,
  oracledb
};
