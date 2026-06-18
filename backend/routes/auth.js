const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '8h';
const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
}

/**
 * POST /api/auth/login
 * Authenticate with DNI + password, returns JWT token + user data.
 */
router.post('/login', async (req, res) => {
  try {
    const { dni, password } = req.body;

    if (!dni || !password) {
      return res.status(400).json({ error: 'DNI y contraseña son requeridos.' });
    }

    // Sanitize DNI - numeric only
    const cleanDni = String(dni).replace(/\D/g, '');
    if (!cleanDni) {
      return res.status(400).json({ error: 'DNI inválido. Solo se aceptan números.' });
    }

    // Find user by DNI
    const result = await db.execute(
      'SELECT * FROM USUARIOS WHERE DNI = :dni',
      [cleanDni]
    );

    if (result.rows.length === 0) {
      await logAudit(null, 'login_failed', `Intento con DNI ${cleanDni} - usuario no encontrado`, getIp(req));
      return res.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (user.ACTIVO !== 1) {
      await logAudit(user.ID, 'login_failed', 'Usuario desactivado', getIp(req));
      return res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador.' });
    }

    // Check if account is locked
    if (user.BLOQUEADO_HASTA) {
      const lockUntil = new Date(user.BLOQUEADO_HASTA);
      if (lockUntil > new Date()) {
        const minutesLeft = Math.ceil((lockUntil - new Date()) / (1000 * 60));
        await logAudit(user.ID, 'login_failed', 'Cuenta bloqueada', getIp(req));
        return res.status(401).json({
          error: `Cuenta bloqueada por demasiados intentos fallidos. Intente en ${minutesLeft} minutos.`
        });
      }
      // Lock expired, reset
      await db.execute(
        'UPDATE USUARIOS SET BLOQUEADO_HASTA = NULL, INTENTOS_FALLIDOS = 0 WHERE ID = :id',
        [user.ID]
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.PASSWORD_HASH);

    if (!passwordMatch) {
      const newAttempts = (user.INTENTOS_FALLIDOS || 0) + 1;

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
        await db.execute(
          'UPDATE USUARIOS SET INTENTOS_FALLIDOS = :attempts, BLOQUEADO_HASTA = :lockUntil WHERE ID = :id',
          { attempts: newAttempts, lockUntil, id: user.ID }
        );
        await logAudit(user.ID, 'account_locked', `Bloqueado tras ${newAttempts} intentos`, getIp(req));
        return res.status(401).json({
          error: `Cuenta bloqueada por ${LOCK_DURATION_MINUTES} minutos tras ${MAX_LOGIN_ATTEMPTS} intentos fallidos.`
        });
      }

      await db.execute(
        'UPDATE USUARIOS SET INTENTOS_FALLIDOS = :attempts WHERE ID = :id',
        { attempts: newAttempts, id: user.ID }
      );
      await logAudit(user.ID, 'login_failed', `Contraseña incorrecta (intento ${newAttempts})`, getIp(req));
      return res.status(401).json({ error: 'DNI o contraseña incorrectos.' });
    }

    // Successful login - reset failed attempts and update last login
    await db.execute(
      'UPDATE USUARIOS SET INTENTOS_FALLIDOS = 0, BLOQUEADO_HASTA = NULL, ULTIMO_LOGIN = :now WHERE ID = :id',
      { now: new Date().toISOString(), id: user.ID }
    );

    // Generate JWT
    const tokenPayload = {
      id: user.ID,
      dni: user.DNI,
      rol: user.ROL_SISTEMA,
      equipoId: user.EQUIPO_ID
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    // Get display name (from EQUIPO if linked, or NOMBRE_DISPLAY)
    let displayName = user.NOMBRE_DISPLAY || '';
    if (user.EQUIPO_ID) {
      const equipoResult = await db.execute(
        'SELECT NOMBRE, APELLIDO, JERARQUIA, DESTINO FROM EQUIPO WHERE ID = :id',
        [user.EQUIPO_ID]
      );
      if (equipoResult.rows.length > 0) {
        const eq = equipoResult.rows[0];
        const rank = eq.JERARQUIA ? `${eq.JERARQUIA} ` : '';
        displayName = `${rank}${eq.NOMBRE} ${eq.APELLIDO}`;
      }
    }

    await logAudit(user.ID, 'login', 'Login exitoso', getIp(req));

    res.json({
      token,
      user: {
        id: user.ID,
        dni: user.DNI,
        rol: user.ROL_SISTEMA,
        equipoId: user.EQUIPO_ID,
        nombreDisplay: displayName,
        debeCambiarPassword: user.DEBE_CAMBIAR_PASSWORD === 1
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate current session.
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await logAudit(req.user.id, 'logout', 'Sesión cerrada', getIp(req));
    res.json({ success: true, message: 'Sesión cerrada correctamente.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user data. Used to validate session on frontend load.
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute(
      'SELECT * FROM USUARIOS WHERE ID = :id',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];

    // Get display name
    let displayName = user.NOMBRE_DISPLAY || '';
    if (user.EQUIPO_ID) {
      const equipoResult = await db.execute(
        'SELECT NOMBRE, APELLIDO, JERARQUIA, DESTINO FROM EQUIPO WHERE ID = :id',
        [user.EQUIPO_ID]
      );
      if (equipoResult.rows.length > 0) {
        const eq = equipoResult.rows[0];
        const rank = eq.JERARQUIA ? `${eq.JERARQUIA} ` : '';
        displayName = `${rank}${eq.NOMBRE} ${eq.APELLIDO}`;
      }
    }

    res.json({
      id: user.ID,
      dni: user.DNI,
      rol: user.ROL_SISTEMA,
      equipoId: user.EQUIPO_ID,
      nombreDisplay: displayName,
      debeCambiarPassword: user.DEBE_CAMBIAR_PASSWORD === 1
    });
  } catch (err) {
    console.error('Error in GET /me:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/**
 * POST /api/auth/change-password
 * Change own password. Requires current password.
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    // Get current user
    const result = await db.execute(
      'SELECT PASSWORD_HASH FROM USUARIOS WHERE ID = :id',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Verify current password
    const match = await bcrypt.compare(currentPassword, result.rows[0].PASSWORD_HASH);
    if (!match) {
      await logAudit(req.user.id, 'password_change_failed', 'Contraseña actual incorrecta', getIp(req));
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.execute(
      'UPDATE USUARIOS SET PASSWORD_HASH = :hash, DEBE_CAMBIAR_PASSWORD = 0, UPDATED_AT = :now WHERE ID = :id',
      { hash: newHash, now: new Date().toISOString(), id: req.user.id }
    );

    await logAudit(req.user.id, 'password_change', 'Contraseña cambiada por el usuario', getIp(req));

    res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

/* ── Helper functions ── */

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
