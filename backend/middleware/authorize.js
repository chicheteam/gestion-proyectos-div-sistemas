const db = require('../db');

/**
 * Authorization middleware factory.
 * Returns middleware that checks if req.user.rol is in the allowed roles list.
 *
 * For 'carga' role on project endpoints: additionally verifies the user
 * is assigned to the specific project being modified.
 *
 * Usage:
 *   authorize('superadmin', 'admin')           // Only superadmin and admin
 *   authorize('superadmin', 'admin', 'carga')  // Including carga (with project check)
 */
function authorize(...allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticación requerida.' });
    }

    const userRole = req.user.rol;

    // Superadmin always has access
    if (userRole === 'superadmin') {
      return next();
    }

    // Check if user role is in allowed list
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' });
    }

    // For 'carga' role: verify project assignment if this is a project endpoint
    if (userRole === 'carga' && req.params.id) {
      const isProjectRoute = req.baseUrl.includes('/projects') || req.path.includes('/projects');

      if (isProjectRoute) {
        const projectId = req.params.id;
        const allowed = await isUserAssignedToProject(req.user, projectId);

        if (!allowed) {
          return res.status(403).json({
            error: 'No tiene permisos para modificar este proyecto. Solo puede editar proyectos donde está asignado.'
          });
        }
      }
    }

    next();
  };
}

/**
 * Checks if a user (via their equipoId) is assigned to a project
 * as PM, liderTecnico, scrumMaster, productOwner, or in desarrolladores array.
 */
async function isUserAssignedToProject(user, projectId) {
  try {
    const result = await db.execute(
      'SELECT PM, LIDER_TECNICO, SCRUM_MASTER, PRODUCT_OWNER, DESARROLLADORES FROM PROYECTOS WHERE ID = :id',
      [projectId]
    );

    if (result.rows.length === 0) return false;

    const project = result.rows[0];
    const equipoId = user.equipoId;

    if (!equipoId) return false;

    // Check direct role assignments
    if (
      project.PM === equipoId ||
      project.LIDER_TECNICO === equipoId ||
      project.SCRUM_MASTER === equipoId ||
      project.PRODUCT_OWNER === equipoId
    ) {
      return true;
    }

    // Check desarrolladores array (stored as JSON string)
    if (project.DESARROLLADORES) {
      try {
        const devs = JSON.parse(project.DESARROLLADORES);
        if (Array.isArray(devs) && devs.includes(equipoId)) {
          return true;
        }
      } catch (e) {
        // JSON parse error, skip
      }
    }

    return false;
  } catch (err) {
    console.error('Error checking project assignment:', err.message);
    return false;
  }
}

module.exports = authorize;
