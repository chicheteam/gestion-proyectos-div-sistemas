const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const authorize = require('../middleware/authorize');
require('dotenv').config();

const router = express.Router();
const SALT_ROUNDS = 12;

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/**
 * GET /api/users
 * List all users. Accessible by superadmin and admin.
 */
router.get('/', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT U.ID, U.DNI, U.ROL_SISTEMA, U.EQUIPO_ID, U.NOMBRE_DISPLAY,
             U.ACTIVO, U.ULTIMO_LOGIN, U.DEBE_CAMBIAR_PASSWORD, U.CREATED_AT, U.UPDATED_AT,
             E.NOMBRE AS EQUIPO_NOMBRE, E.APELLIDO AS EQUIPO_APELLIDO,
             E.JERARQUIA AS EQUIPO_JERARQUIA, E.DESTINO AS EQUIPO_DESTINO
      FROM USUARIOS U
      LEFT JOIN EQUIPO E ON U.EQUIPO_ID = E.ID
      ORDER BY U.CREATED_AT DESC
    `);

    const users = result.rows.map(row => {
      let displayName = row.NOMBRE_DISPLAY || '';
      if (row.EQUIPO_NOMBRE) {
        const rank = row.EQUIPO_JERARQUIA ? `${row.EQUIPO_JERARQUIA} ` : '';
        displayName = `${rank}${row.EQUIPO_NOMBRE} ${row.EQUIPO_APELLIDO}`;
      }

      return {
        id: row.ID,
        dni: row.DNI,
        rol: row.ROL_SISTEMA,
        equipoId: row.EQUIPO_ID,
        nombreDisplay: displayName,
        activo: row.ACTIVO === 1,
        ultimoLogin: row.ULTIMO_LOGIN || null,
        debeCambiarPassword: row.DEBE_CAMBIAR_PASSWORD === 1,
        createdAt: row.CREATED_AT || '',
        updatedAt: row.UPDATED_AT || ''
      };
    });

    // Admin cannot see superadmin users (only superadmin can)
    const filtered = req.user.rol === 'superadmin'
      ? users
      : users.filter(u => u.rol !== 'superadmin');

    res.json(filtered);
  } catch (err) {
    console.error('Error in GET /api/users:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/users
 * Create a new user. Accessible by superadmin and admin.
 * Admin cannot create superadmin users.
 */
router.post('/', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { dni, password, rol, equipoId, nombreDisplay } = req.body;

    if (!dni || !password) {
      return res.status(400).json({ error: 'DNI y contraseña son requeridos.' });
    }

    // Validate DNI is numeric
    const cleanDni = String(dni).replace(/\D/g, '');
    if (!cleanDni || cleanDni.length < 7 || cleanDni.length > 10) {
      return res.status(400).json({ error: 'DNI inválido. Debe ser un número de 7 a 10 dígitos.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // Validate role
    const validRoles = ['superadmin', 'admin', 'carga', 'lectura'];
    const targetRole = rol || 'lectura';
    if (!validRoles.includes(targetRole)) {
      return res.status(400).json({ error: 'Rol inválido.' });
    }

    // Admin cannot create superadmin users
    if (targetRole === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ error: 'Solo un superadmin puede crear otros superadmins.' });
    }

    // Check DNI uniqueness
    const existing = await db.execute(
      'SELECT ID FROM USUARIOS WHERE DNI = :dni',
      [cleanDni]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese DNI.' });
    }

    // Validate equipoId if provided
    if (equipoId) {
      const equipoCheck = await db.execute(
        'SELECT ID FROM EQUIPO WHERE ID = :id',
        [equipoId]
      );
      if (equipoCheck.rows.length === 0) {
        return res.status(400).json({ error: 'El miembro de equipo especificado no existe.' });
      }
    }

    // Hash password and create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = generateId();
    const now = new Date().toISOString();

    await db.execute(
      `INSERT INTO USUARIOS (ID, DNI, PASSWORD_HASH, ROL_SISTEMA, EQUIPO_ID, NOMBRE_DISPLAY, ACTIVO, DEBE_CAMBIAR_PASSWORD, CREATED_AT, UPDATED_AT)
       VALUES (:id, :dni, :hash, :rol, :equipoId, :nombreDisplay, 1, 1, :now, :now)`,
      {
        id,
        dni: cleanDni,
        hash: passwordHash,
        rol: targetRole,
        equipoId: equipoId || null,
        nombreDisplay: nombreDisplay || null,
        now
      }
    );

    // Audit log
    await logAudit(req.user.id, 'user_create', `Usuario creado: DNI ${cleanDni}, rol ${targetRole}`, getIp(req));

    res.status(201).json({
      id,
      dni: cleanDni,
      rol: targetRole,
      equipoId: equipoId || null,
      nombreDisplay: nombreDisplay || '',
      activo: true,
      debeCambiarPassword: true,
      createdAt: now
    });
  } catch (err) {
    console.error('Error in POST /api/users:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * PUT /api/users/:id
 * Update user (role, active status, equipoId, display name).
 * Cannot modify own role. Cannot promote to superadmin unless you are superadmin.
 */
router.put('/:id', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { rol, equipoId, nombreDisplay, activo } = req.body;

    // Check user exists
    const existing = await db.execute(
      'SELECT * FROM USUARIOS WHERE ID = :id',
      [userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const currentUser = existing.rows[0];

    // Prevent self-role modification
    if (userId === req.user.id && rol && rol !== currentUser.ROL_SISTEMA) {
      return res.status(403).json({ error: 'No puede modificar su propio rol.' });
    }

    // Admin cannot modify superadmin users
    if (currentUser.ROL_SISTEMA === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ error: 'No tiene permisos para modificar un superadmin.' });
    }

    // Admin cannot promote to superadmin
    if (rol === 'superadmin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ error: 'Solo un superadmin puede asignar el rol superadmin.' });
    }

    // Validate role if provided
    if (rol) {
      const validRoles = ['superadmin', 'admin', 'carga', 'lectura'];
      if (!validRoles.includes(rol)) {
        return res.status(400).json({ error: 'Rol inválido.' });
      }
    }

    // Build update
    const updates = {};
    if (rol !== undefined) updates.rol = rol;
    if (equipoId !== undefined) updates.equipoId = equipoId;
    if (nombreDisplay !== undefined) updates.nombreDisplay = nombreDisplay;
    if (activo !== undefined) updates.activo = activo ? 1 : 0;

    const setClauses = [];
    const binds = { id: userId, now: new Date().toISOString() };

    if (updates.rol !== undefined) {
      setClauses.push('ROL_SISTEMA = :rol');
      binds.rol = updates.rol;
    }
    if (updates.equipoId !== undefined) {
      setClauses.push('EQUIPO_ID = :equipoId');
      binds.equipoId = updates.equipoId || null;
    }
    if (updates.nombreDisplay !== undefined) {
      setClauses.push('NOMBRE_DISPLAY = :nombreDisplay');
      binds.nombreDisplay = updates.nombreDisplay || null;
    }
    if (updates.activo !== undefined) {
      setClauses.push('ACTIVO = :activo');
      binds.activo = updates.activo;
    }

    setClauses.push('UPDATED_AT = :now');

    if (setClauses.length > 1) {
      await db.execute(
        `UPDATE USUARIOS SET ${setClauses.join(', ')} WHERE ID = :id`,
        binds
      );
    }

    await logAudit(req.user.id, 'user_update', `Usuario ${currentUser.DNI} actualizado: ${JSON.stringify(updates)}`, getIp(req));

    res.json({ success: true, message: 'Usuario actualizado correctamente.' });
  } catch (err) {
    console.error('Error in PUT /api/users/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * DELETE /api/users/:id
 * Deactivate a user (soft delete). Only superadmin.
 */
router.delete('/:id', authMiddleware, authorize('superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(403).json({ error: 'No puede desactivar su propia cuenta.' });
    }

    const existing = await db.execute('SELECT DNI FROM USUARIOS WHERE ID = :id', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    await db.execute(
      'UPDATE USUARIOS SET ACTIVO = 0, UPDATED_AT = :now WHERE ID = :id',
      { now: new Date().toISOString(), id: userId }
    );

    await logAudit(req.user.id, 'user_deactivate', `Usuario ${existing.rows[0].DNI} desactivado`, getIp(req));

    res.json({ success: true, message: 'Usuario desactivado.' });
  } catch (err) {
    console.error('Error in DELETE /api/users/:id:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Reset a user's password. Only superadmin.
 */
router.post('/:id/reset-password', authMiddleware, authorize('superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const existing = await db.execute('SELECT DNI FROM USUARIOS WHERE ID = :id', [userId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.execute(
      'UPDATE USUARIOS SET PASSWORD_HASH = :hash, DEBE_CAMBIAR_PASSWORD = 1, INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL, UPDATED_AT = :now WHERE ID = :id',
      { hash, now: new Date().toISOString(), id: userId }
    );

    await logAudit(req.user.id, 'password_reset', `Contraseña reseteada para usuario ${existing.rows[0].DNI}`, getIp(req));

    res.json({ success: true, message: 'Contraseña reseteada. El usuario deberá cambiarla en su próximo login.' });
  } catch (err) {
    console.error('Error in reset-password:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/users/audit-log
 * Get audit log entries. Only superadmin.
 */
router.get('/audit-log', authMiddleware, authorize('superadmin'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await db.execute(
      `SELECT * FROM AUDIT_LOG ORDER BY TIMESTAMP DESC FETCH FIRST :limit ROWS ONLY`,
      [limit]
    );

    const logs = result.rows.map(row => ({
      id: row.ID,
      usuarioId: row.USUARIO_ID,
      accion: row.ACCION,
      detalle: row.DETALLE,
      ipAddress: row.IP_ADDRESS,
      timestamp: row.TIMESTAMP
    }));

    res.json(logs);
  } catch (err) {
    console.error('Error in GET /api/users/audit-log:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ── Helpers ── */

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
}

async function logAudit(userId, action, detail, ipAddress) {
  try {
    await db.execute(
      'INSERT INTO AUDIT_LOG (ID, USUARIO_ID, ACCION, DETALLE, IP_ADDRESS, TIMESTAMP) VALUES (:id, :userId, :action, :detail, :ip, :ts)',
      {
        id: generateId(),
        userId: userId || null,
        action,
        detail: (detail || '').substring(0, 1000),
        ip: (ipAddress || '').substring(0, 45),
        ts: new Date().toISOString()
      }
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = router;
