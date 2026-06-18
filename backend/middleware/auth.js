const jwt = require('jsonwebtoken');
const db = require('../db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

/**
 * Authentication middleware - verifies JWT token from Authorization header.
 * Attaches req.user with { id, dni, rol, equipoId, nombreDisplay } on success.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token requerido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const result = await db.execute(
      'SELECT ID, DNI, ROL_SISTEMA, EQUIPO_ID, NOMBRE_DISPLAY, ACTIVO FROM USUARIOS WHERE ID = :id',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    const user = result.rows[0];

    if (user.ACTIVO !== 1) {
      return res.status(401).json({ error: 'Usuario desactivado. Contacte al administrador.' });
    }

    // Attach user data to request
    req.user = {
      id: user.ID,
      dni: user.DNI,
      rol: user.ROL_SISTEMA,
      equipoId: user.EQUIPO_ID,
      nombreDisplay: user.NOMBRE_DISPLAY
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sesión expirada. Inicie sesión nuevamente.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido.' });
    }
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({ error: 'Error interno de autenticación.' });
  }
}

module.exports = authMiddleware;
