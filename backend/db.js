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
    // Check if base tables exist
    const checkTable = await execute(`
      SELECT table_name FROM user_tables WHERE table_name = 'PROYECTOS'
    `);

    if (checkTable.rows && checkTable.rows.length > 0) {
      console.log('Base tables already exist. Checking auth tables...');
      // Check if auth tables need to be created
      await ensureAuthTables();
      await seedSuperAdmin();
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

    // Seed superadmin after full schema init
    await seedSuperAdmin();
  } catch (err) {
    console.error('Error during schema initialization:', err);
  }
}

/**
 * Ensure auth tables exist (for existing databases that need upgrade).
 */
async function ensureAuthTables() {
  const authTables = ['USUARIOS', 'SESIONES', 'AUDIT_LOG'];

  for (const tableName of authTables) {
    try {
      const check = await execute(
        `SELECT table_name FROM user_tables WHERE table_name = :name`,
        [tableName]
      );

      if (check.rows.length === 0) {
        console.log(`Creating missing auth table: ${tableName}...`);
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Find the CREATE TABLE statement for this table (up to the ending );)
        const regex = new RegExp(`CREATE TABLE ${tableName}\\s*\\([\\s\\S]*?\\);`, 'i');
        const match = schemaSql.match(regex);

        if (match) {
          // Remove the trailing semicolon since execute doesn't expect it in oracledb
          const ddl = match[0].replace(/;$/, '').trim();
          await execute(ddl);
          console.log(`Table ${tableName} created successfully.`);
        } else {
          console.error(`Could not find CREATE TABLE statement for ${tableName} in schema.sql`);
        }
      }
    } catch (err) {
      console.error(`Error checking/creating table ${tableName}:`, err.message);
    }
  }
}

/**
 * Seed the initial superadmin user if no superadmin exists.
 * Uses SUPERADMIN_DNI and SUPERADMIN_INITIAL_PASSWORD from environment variables.
 */
async function seedSuperAdmin() {
  try {
    // Check if any superadmin exists
    const check = await execute(
      "SELECT ID FROM USUARIOS WHERE ROL_SISTEMA = 'superadmin'"
    );

    if (check.rows.length > 0) {
      console.log('Superadmin user already exists. Skipping seed.');
      return;
    }

    const dni = process.env.SUPERADMIN_DNI;
    const initialPassword = process.env.SUPERADMIN_INITIAL_PASSWORD;

    if (!dni || !initialPassword) {
      console.warn('WARNING: No SUPERADMIN_DNI or SUPERADMIN_INITIAL_PASSWORD set in environment variables.');
      console.warn('Set these variables to create the initial superadmin user on first boot.');
      return;
    }

    // Import bcrypt here (lazy load to avoid circular deps at module level)
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const id = 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO USUARIOS (ID, DNI, PASSWORD_HASH, ROL_SISTEMA, NOMBRE_DISPLAY, ACTIVO, DEBE_CAMBIAR_PASSWORD, CREATED_AT, UPDATED_AT)
       VALUES (:id, :dni, :hash, 'superadmin', :displayName, 1, 1, :now, :now)`,
      {
        id,
        dni: String(dni).replace(/\D/g, ''),
        hash: passwordHash,
        displayName: 'Super Administrador',
        now
      }
    );

    console.log(`Initial superadmin user created with DNI: ${dni}. Please change the password on first login.`);
  } catch (err) {
    console.error('Error seeding superadmin:', err.message);
  }
}

module.exports = {
  initializeDatabase,
  execute,
  oracledb
};
