const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const authMiddleware = require('./middleware/auth');
const authorize = require('./middleware/authorize');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1); // Trust the Nginx reverse proxy
const port = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for frontend
}));

// CORS - configure for intranet deployment
app.use(cors());

// Rate limiting for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  message: { error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Oracle CLOB/PDF files can be large, so we increase body limits
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

/* ── AUTH & USER ROUTES (mounted before protected routes) ── */

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);

/* ── MAPPING HELPERS ── */

function mapProjectFromDb(row) {
  if (!row) return null;
  return {
    id: row.ID,
    nombre: row.NOMBRE || '',
    descripcion: row.DESCRIPCION || '',
    expediente: row.EXPEDIENTE || '',
    notaSolicitud: row.NOTA_SOLICITUD || '',
    notaSolicitudPdf: (() => {
      if (!row.NOTA_SOLICITUD_PDF) return null;
      try {
        return JSON.parse(row.NOTA_SOLICITUD_PDF);
      } catch (e) {
        if (typeof row.NOTA_SOLICITUD_PDF === 'object') return row.NOTA_SOLICITUD_PDF;
        return { nombre: 'Documento adjunto', data: row.NOTA_SOLICITUD_PDF };
      }
    })(),
    areaSolicitante: row.AREA_SOLICITANTE || '',
    linkDocumento: row.LINK_DOCUMENTO || '',
    estado: row.ESTADO || 'solicitud',
    prioridad: row.PRIORIDAD || 'media',
    dificultad: Number(row.DIFICULTAD) || 3,
    porcentajeAvance: Number(row.PORCENTAJE_AVANCE) || 0,
    sprintActual: row.SPRINT_ACTUAL || '',
    pm: row.PM || '',
    liderTecnico: row.LIDER_TECNICO || '',
    scrumMaster: row.SCRUM_MASTER || '',
    productOwner: row.PRODUCT_OWNER || '',
    analistaFuncional: row.ANALISTA_FUNCIONAL || '',
    qaTester: row.QA_TESTER || '',
    dba: row.DBA_ASIGNADO || '',
    uxuiDesigner: row.UXUI_DESIGNER || '',
    desarrolladores: row.DESARROLLADORES ? JSON.parse(row.DESARROLLADORES) : [],
    fechaSolicitud: row.FECHA_SOLICITUD || '',
    fechaEstimadaInicio: row.FECHA_ESTIMADA_INICIO || '',
    fechaEstimadaFin: row.FECHA_ESTIMADA_FIN || '',
    fechaRealInicio: row.FECHA_REAL_INICIO || '',
    fechaRealFin: row.FECHA_REAL_FIN || '',
    fechaProduccion: row.FECHA_PRODUCCION || '',
    tags: row.TAGS ? JSON.parse(row.TAGS) : [],
    observaciones: row.OBSERVACIONES || '',
    minutas: row.MINUTAS ? JSON.parse(row.MINUTAS) : [],
    ticketsMantis: row.TICKETS_MANTIS ? JSON.parse(row.TICKETS_MANTIS) : [],
    ticketsTaiga: row.TICKETS_TAIGA ? JSON.parse(row.TICKETS_TAIGA) : [],
    ticketsJira: row.TICKETS_JIRA ? JSON.parse(row.TICKETS_JIRA) : [],
    ticketsGitlab: row.TICKETS_GITLAB ? JSON.parse(row.TICKETS_GITLAB) : [],
    kanbanPinned: row.KANBAN_PINNED === 1,
    createdAt: row.CREATED_AT || '',
    updatedAt: row.UPDATED_AT || ''
  };
}

function mapTeamFromDb(row) {
  if (!row) return null;
  return {
    id: row.ID,
    nombre: row.NOMBRE || '',
    apellido: row.APELLIDO || '',
    jerarquia: row.JERARQUIA || '',
    destino: row.DESTINO || '',
    rol: row.ROL || 'Desarrollador',
    email: row.EMAIL || '',
    celular: row.CELULAR || '',
    telefonoTrabajo: row.TELEFONO_TRABAJO || '',
    isExterno: row.IS_EXTERNO === 1,
    activo: row.ACTIVO === 1,
    maxProyectos: Number(row.MAX_PROYECTOS) || 5,
    createdAt: row.CREATED_AT || ''
  };
}

function mapHistoryFromDb(row) {
  if (!row) return null;
  return {
    id: row.ID,
    action: row.ACCION || '',
    entity: row.ENTIDAD || '',
    entityId: row.ENTIDAD_ID || null,
    description: row.DESCRIPCION || '',
    timestamp: row.TIMESTAMP || ''
  };
}

/* ── ENDPOINTS: PROJECTS (all protected) ── */

// GET - any authenticated user can read
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM PROYECTOS');
    const projects = result.rows.map(mapProjectFromDb);
    res.json(projects);
  } catch (err) {
    console.error('API Error in GET /api/projects:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM PROYECTOS WHERE ID = :id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(mapProjectFromDb(result.rows[0]));
  } catch (err) {
    console.error('API Error in GET /api/projects/:id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST - superadmin, admin can create; carga cannot create new projects
app.post('/api/projects', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const p = req.body;
    const query = `
      INSERT INTO PROYECTOS (
        ID, NOMBRE, DESCRIPCION, EXPEDIENTE, NOTA_SOLICITUD, NOTA_SOLICITUD_PDF, AREA_SOLICITANTE, LINK_DOCUMENTO,
        ESTADO, PRIORIDAD, DIFICULTAD, PORCENTAJE_AVANCE, SPRINT_ACTUAL, PM, LIDER_TECNICO, SCRUM_MASTER, PRODUCT_OWNER,
        ANALISTA_FUNCIONAL, QA_TESTER, DBA_ASIGNADO, UXUI_DESIGNER,
        DESARROLLADORES, FECHA_SOLICITUD, FECHA_ESTIMADA_INICIO, FECHA_ESTIMADA_FIN, FECHA_REAL_INICIO, FECHA_REAL_FIN, FECHA_PRODUCCION,
        TAGS, OBSERVACIONES, MINUTAS, TICKETS_MANTIS, TICKETS_TAIGA, TICKETS_JIRA, TICKETS_GITLAB, KANBAN_PINNED, CREATED_AT, UPDATED_AT
      ) VALUES (
        :id, :nombre, :descripcion, :expediente, :notaSolicitud, :notaSolicitudPdf, :areaSolicitante, :linkDocumento,
        :estado, :prioridad, :dificultad, :porcentajeAvance, :sprintActual, :pm, :liderTecnico, :scrumMaster, :productOwner,
        :analistaFuncional, :qaTester, :dba, :uxuiDesigner,
        :desarrolladores, :fechaSolicitud, :fechaEstimadaInicio, :fechaEstimadaFin, :fechaRealInicio, :fechaRealFin, :fechaProduccion,
        :tags, :observaciones, :minutas, :ticketsMantis, :ticketsTaiga, :ticketsJira, :ticketsGitlab, :kanbanPinned, :createdAt, :updatedAt
      )
    `;

    const binds = {
      id: p.id,
      nombre: p.nombre || '',
      descripcion: { type: db.oracledb.CLOB, val: p.descripcion || '' },
      expediente: p.expediente || '',
      notaSolicitud: p.notaSolicitud || '',
      notaSolicitudPdf: { type: db.oracledb.CLOB, val: p.notaSolicitudPdf ? JSON.stringify(p.notaSolicitudPdf) : null },
      areaSolicitante: p.areaSolicitante || '',
      linkDocumento: p.linkDocumento || '',
      estado: p.estado || 'solicitud',
      prioridad: p.prioridad || 'media',
      dificultad: Number(p.dificultad) || 3,
      porcentajeAvance: Number(p.porcentajeAvance) || 0,
      sprintActual: p.sprintActual || '',
      pm: p.pm || '',
      liderTecnico: p.liderTecnico || '',
      scrumMaster: p.scrumMaster || '',
      productOwner: p.productOwner || '',
      analistaFuncional: p.analistaFuncional || '',
      qaTester: p.qaTester || '',
      dba: p.dba || '',
      uxuiDesigner: p.uxuiDesigner || '',
      desarrolladores: { type: db.oracledb.CLOB, val: JSON.stringify(p.desarrolladores || []) },
      fechaSolicitud: p.fechaSolicitud || '',
      fechaEstimadaInicio: p.fechaEstimadaInicio || '',
      fechaEstimadaFin: p.fechaEstimadaFin || '',
      fechaRealInicio: p.fechaRealInicio || '',
      fechaRealFin: p.fechaRealFin || '',
      fechaProduccion: p.fechaProduccion || '',
      tags: { type: db.oracledb.CLOB, val: JSON.stringify(p.tags || []) },
      observaciones: { type: db.oracledb.CLOB, val: p.observaciones || '' },
      minutas: { type: db.oracledb.CLOB, val: JSON.stringify(p.minutas || []) },
      ticketsMantis: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsMantis || []) },
      ticketsTaiga: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsTaiga || []) },
      ticketsJira: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsJira || []) },
      ticketsGitlab: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsGitlab || []) },
      kanbanPinned: p.kanbanPinned ? 1 : 0,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString()
    };

    await db.execute(query, binds);
    res.status(201).json(p);
  } catch (err) {
    console.error('API Error in POST /api/projects:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT - superadmin, admin, and carga (carga with project assignment check)
app.put('/api/projects/:id', authMiddleware, authorize('superadmin', 'admin', 'carga'), async (req, res) => {
  try {
    const p = req.body;
    const id = req.params.id;

    // First check if it exists
    const check = await db.execute('SELECT * FROM PROYECTOS WHERE ID = :id', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const query = `
      UPDATE PROYECTOS SET
        NOMBRE = :nombre,
        DESCRIPCION = :descripcion,
        EXPEDIENTE = :expediente,
        NOTA_SOLICITUD = :notaSolicitud,
        NOTA_SOLICITUD_PDF = NVL(:notaSolicitudPdf, NOTA_SOLICITUD_PDF),
        AREA_SOLICITANTE = :areaSolicitante,
        LINK_DOCUMENTO = :linkDocumento,
        ESTADO = :estado,
        PRIORIDAD = :prioridad,
        DIFICULTAD = :dificultad,
        PORCENTAJE_AVANCE = :porcentajeAvance,
        SPRINT_ACTUAL = :sprintActual,
        PM = :pm,
        LIDER_TECNICO = :liderTecnico,
        SCRUM_MASTER = :scrumMaster,
        PRODUCT_OWNER = :productOwner,
        ANALISTA_FUNCIONAL = :analistaFuncional,
        QA_TESTER = :qaTester,
        DBA_ASIGNADO = :dba,
        UXUI_DESIGNER = :uxuiDesigner,
        DESARROLLADORES = :desarrolladores,
        FECHA_SOLICITUD = :fechaSolicitud,
        FECHA_ESTIMADA_INICIO = :fechaEstimadaInicio,
        FECHA_ESTIMADA_FIN = :fechaEstimadaFin,
        FECHA_REAL_INICIO = :fechaRealInicio,
        FECHA_REAL_FIN = :fechaRealFin,
        FECHA_PRODUCCION = :fechaProduccion,
        TAGS = :tags,
        OBSERVACIONES = :observaciones,
        MINUTAS = :minutas,
        TICKETS_MANTIS = :ticketsMantis,
        TICKETS_TAIGA = :ticketsTaiga,
        TICKETS_JIRA = :ticketsJira,
        TICKETS_GITLAB = :ticketsGitlab,
        KANBAN_PINNED = :kanbanPinned,
        UPDATED_AT = :updatedAt
      WHERE ID = :id
    `;

    let pdfVal = p.notaSolicitudPdf;
    if (pdfVal === undefined || pdfVal === null) {
      pdfVal = null;
    } else {
      pdfVal = JSON.stringify(pdfVal);
    }

    const binds = {
      id,
      nombre: p.nombre,
      descripcion: { type: db.oracledb.CLOB, val: p.descripcion || '' },
      expediente: p.expediente || '',
      notaSolicitud: p.notaSolicitud || '',
      notaSolicitudPdf: { type: db.oracledb.CLOB, val: pdfVal },
      areaSolicitante: p.areaSolicitante || '',
      linkDocumento: p.linkDocumento || '',
      estado: p.estado,
      prioridad: p.prioridad,
      dificultad: Number(p.dificultad),
      porcentajeAvance: Number(p.porcentajeAvance),
      sprintActual: p.sprintActual || '',
      pm: p.pm || '',
      liderTecnico: p.liderTecnico || '',
      scrumMaster: p.scrumMaster || '',
      productOwner: p.productOwner || '',
      analistaFuncional: p.analistaFuncional || '',
      qaTester: p.qaTester || '',
      dba: p.dba || '',
      uxuiDesigner: p.uxuiDesigner || '',
      desarrolladores: { type: db.oracledb.CLOB, val: JSON.stringify(p.desarrolladores || []) },
      fechaSolicitud: p.fechaSolicitud || '',
      fechaEstimadaInicio: p.fechaEstimadaInicio || '',
      fechaEstimadaFin: p.fechaEstimadaFin || '',
      fechaRealInicio: p.fechaRealInicio || '',
      fechaRealFin: p.fechaRealFin || '',
      fechaProduccion: p.fechaProduccion || '',
      tags: { type: db.oracledb.CLOB, val: JSON.stringify(p.tags || []) },
      observaciones: { type: db.oracledb.CLOB, val: p.observaciones || '' },
      minutas: { type: db.oracledb.CLOB, val: JSON.stringify(p.minutas || []) },
      ticketsMantis: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsMantis || []) },
      ticketsTaiga: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsTaiga || []) },
      ticketsJira: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsJira || []) },
      ticketsGitlab: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsGitlab || []) },
      kanbanPinned: p.kanbanPinned ? 1 : 0,
      updatedAt: new Date().toISOString()
    };

    await db.execute(query, binds);
    
    // Fetch and return updated project
    const updated = await db.execute('SELECT * FROM PROYECTOS WHERE ID = :id', [id]);
    res.json(mapProjectFromDb(updated.rows[0]));
  } catch (err) {
    console.error('API Error in PUT /api/projects/:id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE - only superadmin and admin
app.delete('/api/projects/:id', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const result = await db.execute('DELETE FROM PROYECTOS WHERE ID = :id', [req.params.id]);
    res.json({ success: true, rowsAffected: result.rowsAffected });
  } catch (err) {
    console.error('API Error in DELETE /api/projects/:id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ── ENDPOINTS: TEAM (protected) ── */

// GET - any authenticated user
app.get('/api/team', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM EQUIPO');
    const team = result.rows.map(mapTeamFromDb);
    res.json(team);
  } catch (err) {
    console.error('API Error in GET /api/team:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST/PUT/DELETE team - only superadmin and admin
app.post('/api/team', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const m = req.body;
    const query = `
      INSERT INTO EQUIPO (
        ID, NOMBRE, APELLIDO, JERARQUIA, DESTINO, ROL, EMAIL, CELULAR, TELEFONO_TRABAJO, IS_EXTERNO, ACTIVO, MAX_PROYECTOS, CREATED_AT
      ) VALUES (
        :id, :nombre, :apellido, :jerarquia, :destino, :rol, :email, :celular, :telefonoTrabajo, :isExterno, :activo, :maxProyectos, :createdAt
      )
    `;
    const binds = {
      id: m.id,
      nombre: m.nombre || '',
      apellido: m.apellido || '',
      jerarquia: m.jerarquia || '',
      destino: m.destino || '',
      rol: m.rol || 'Desarrollador',
      email: m.email || '',
      celular: m.celular || '',
      telefonoTrabajo: m.telefonoTrabajo || '',
      isExterno: m.isExterno ? 1 : 0,
      activo: m.activo !== false ? 1 : 0,
      maxProyectos: Number(m.maxProyectos) || 5,
      createdAt: m.createdAt || new Date().toISOString()
    };
    await db.execute(query, binds);
    res.status(201).json(m);
  } catch (err) {
    console.error('API Error in POST /api/team:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/team/:id', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const m = req.body;
    const id = req.params.id;

    const query = `
      UPDATE EQUIPO SET
        NOMBRE = :nombre,
        APELLIDO = :apellido,
        JERARQUIA = :jerarquia,
        DESTINO = :destino,
        ROL = :rol,
        EMAIL = :email,
        CELULAR = :celular,
        TELEFONO_TRABAJO = :telefonoTrabajo,
        IS_EXTERNO = :isExterno,
        ACTIVO = :activo,
        MAX_PROYECTOS = :maxProyectos
      WHERE ID = :id
    `;
    const binds = {
      id,
      nombre: m.nombre,
      apellido: m.apellido,
      jerarquia: m.jerarquia || '',
      destino: m.destino || '',
      rol: m.rol,
      email: m.email || '',
      celular: m.celular || '',
      telefonoTrabajo: m.telefonoTrabajo || '',
      isExterno: m.isExterno ? 1 : 0,
      activo: m.activo !== false ? 1 : 0,
      maxProyectos: Number(m.maxProyectos)
    };
    await db.execute(query, binds);
    res.json({ success: true });
  } catch (err) {
    console.error('API Error in PUT /api/team/:id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/team/:id', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    await db.execute('DELETE FROM EQUIPO WHERE ID = :id', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('API Error in DELETE /api/team/:id:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ── ENDPOINTS: HISTORY (protected) ── */

app.get('/api/history', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM HISTORIAL ORDER BY TIMESTAMP DESC');
    const history = result.rows.map(mapHistoryFromDb);
    res.json(history);
  } catch (err) {
    console.error('API Error in GET /api/history:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/history', authMiddleware, async (req, res) => {
  try {
    const h = req.body;
    const query = `
      INSERT INTO HISTORIAL (ID, ACCION, ENTIDAD, ENTIDAD_ID, DESCRIPCION, TIMESTAMP)
      VALUES (:id, :action, :entity, :entityId, :description, :timestamp)
    `;
    const binds = {
      id: h.id,
      action: h.action,
      entity: h.entity,
      entityId: h.entityId || null,
      description: h.description,
      timestamp: h.timestamp || new Date().toISOString()
    };
    await db.execute(query, binds);
    res.status(201).json(h);
  } catch (err) {
    console.error('API Error in POST /api/history:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ── ENDPOINTS: CONFIGURACION (SETTINGS) ── */

app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM CONFIGURACION WHERE CLAVE = :key', ['notif_settings']);
    if (result.rows.length === 0) {
      // Return defaults
      return res.json({
        deadlinesEnabled: true,
        deadlineDays: 15,
        saturatedTeamEnabled: true,
        missingDatesEnabled: true,
        inconsistenciesEnabled: true,
        thresholdTeamLoadRed: 85,
        thresholdTeamLoadYellow: 60,
        thresholdOnTimeRed: 50,
        thresholdOnTimeYellow: 80,
        thresholdBlockedRed: 3,
        thresholdBlockedYellow: 1,
        thresholdPendingRed: 6,
        thresholdPendingYellow: 3,
        thresholdNoTeamRed: 2,
        thresholdNoTeamYellow: 1
      });
    }
    res.json(JSON.parse(result.rows[0].VALOR));
  } catch (err) {
    console.error('API Error in GET /api/settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT settings - only superadmin and admin
app.put('/api/settings', authMiddleware, authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const settings = req.body;
    const check = await db.execute('SELECT * FROM CONFIGURACION WHERE CLAVE = :key', ['notif_settings']);
    if (check.rows.length === 0) {
      await db.execute('INSERT INTO CONFIGURACION (CLAVE, VALOR) VALUES (:key, :value)', {
        key: 'notif_settings',
        value: JSON.stringify(settings)
      });
    } else {
      await db.execute('UPDATE CONFIGURACION SET VALOR = :value WHERE CLAVE = :key', {
        key: 'notif_settings',
        value: JSON.stringify(settings)
      });
    }
    res.json(settings);
  } catch (err) {
    console.error('API Error in PUT /api/settings:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/* ── ENDPOINTS: MIGRATION (superadmin only) ── */

app.post('/api/migrate', authMiddleware, authorize('superadmin'), async (req, res) => {
  try {
    const { projects, team, history, settings } = req.body;
    console.log(`Starting migration of ${projects?.length || 0} projects, ${team?.length || 0} team members, and ${history?.length || 0} history records.`);

    // 1. Clean existing tables to avoid duplicate keys during migration
    await db.execute('DELETE FROM CONFIGURACION');
    await db.execute('DELETE FROM HISTORIAL');
    await db.execute('DELETE FROM PROYECTOS');
    await db.execute('DELETE FROM EQUIPO');

    // 2. Migrate Team
    if (Array.isArray(team)) {
      for (const m of team) {
        const query = `
          INSERT INTO EQUIPO (
            ID, NOMBRE, APELLIDO, JERARQUIA, DESTINO, ROL, EMAIL, CELULAR, TELEFONO_TRABAJO, IS_EXTERNO, ACTIVO, MAX_PROYECTOS, CREATED_AT
          ) VALUES (
            :id, :nombre, :apellido, :jerarquia, :destino, :rol, :email, :celular, :telefonoTrabajo, :isExterno, :activo, :maxProyectos, :createdAt
          )
        `;
        await db.execute(query, {
          id: m.id,
          nombre: m.nombre || '',
          apellido: m.apellido || '',
          jerarquia: m.jerarquia || '',
          destino: m.destino || '',
          rol: m.rol || 'Desarrollador',
          email: m.email || '',
          celular: m.celular || '',
          telefonoTrabajo: m.telefonoTrabajo || '',
          isExterno: m.isExterno ? 1 : 0,
          activo: m.activo !== false ? 1 : 0,
          maxProyectos: Number(m.maxProyectos) || 5,
          createdAt: m.createdAt || new Date().toISOString()
        });
      }
    }

    // 3. Migrate Projects
    if (Array.isArray(projects)) {
      for (const p of projects) {
        const query = `
          INSERT INTO PROYECTOS (
            ID, NOMBRE, DESCRIPCION, EXPEDIENTE, NOTA_SOLICITUD, NOTA_SOLICITUD_PDF, AREA_SOLICITANTE, LINK_DOCUMENTO,
            ESTADO, PRIORIDAD, DIFICULTAD, PORCENTAJE_AVANCE, SPRINT_ACTUAL, PM, LIDER_TECNICO, SCRUM_MASTER, PRODUCT_OWNER,
            ANALISTA_FUNCIONAL, QA_TESTER, DBA_ASIGNADO, UXUI_DESIGNER,
            DESARROLLADORES, FECHA_SOLICITUD, FECHA_ESTIMADA_INICIO, FECHA_ESTIMADA_FIN, FECHA_REAL_INICIO, FECHA_REAL_FIN, FECHA_PRODUCCION,
            TAGS, OBSERVACIONES, MINUTAS, TICKETS_MANTIS, TICKETS_TAIGA, TICKETS_JIRA, TICKETS_GITLAB, KANBAN_PINNED, CREATED_AT, UPDATED_AT
          ) VALUES (
            :id, :nombre, :descripcion, :expediente, :notaSolicitud, :notaSolicitudPdf, :areaSolicitante, :linkDocumento,
            :estado, :prioridad, :dificultad, :porcentajeAvance, :sprintActual, :pm, :liderTecnico, :scrumMaster, :productOwner,
            :analistaFuncional, :qaTester, :dba, :uxuiDesigner,
            :desarrolladores, :fechaSolicitud, :fechaEstimadaInicio, :fechaEstimadaFin, :fechaRealInicio, :fechaRealFin, :fechaProduccion,
            :tags, :observaciones, :minutas, :ticketsMantis, :ticketsTaiga, :ticketsJira, :ticketsGitlab, :kanbanPinned, :createdAt, :updatedAt
          )
        `;
        await db.execute(query, {
          id: p.id,
          nombre: p.nombre || '',
          descripcion: { type: db.oracledb.CLOB, val: p.descripcion || '' },
          expediente: p.expediente || '',
          notaSolicitud: p.notaSolicitud || '',
          notaSolicitudPdf: { type: db.oracledb.CLOB, val: p.notaSolicitudPdf ? JSON.stringify(p.notaSolicitudPdf) : null },
          areaSolicitante: p.areaSolicitante || '',
          linkDocumento: p.linkDocumento || '',
          estado: p.estado || 'solicitud',
          prioridad: p.prioridad || 'media',
          dificultad: Number(p.dificultad) || 3,
          porcentajeAvance: Number(p.porcentajeAvance) || 0,
          sprintActual: p.sprintActual || '',
          pm: p.pm || '',
          liderTecnico: p.liderTecnico || '',
          scrumMaster: p.scrumMaster || '',
          productOwner: p.productOwner || '',
          analistaFuncional: p.analistaFuncional || '',
          qaTester: p.qaTester || '',
          dba: p.dba || '',
          uxuiDesigner: p.uxuiDesigner || '',
          desarrolladores: { type: db.oracledb.CLOB, val: JSON.stringify(p.desarrolladores || []) },
          fechaSolicitud: p.fechaSolicitud || '',
          fechaEstimadaInicio: p.fechaEstimadaInicio || '',
          fechaEstimadaFin: p.fechaEstimadaFin || '',
          fechaRealInicio: p.fechaRealInicio || '',
          fechaRealFin: p.fechaRealFin || '',
          fechaProduccion: p.fechaProduccion || '',
          tags: { type: db.oracledb.CLOB, val: JSON.stringify(p.tags || []) },
          observaciones: { type: db.oracledb.CLOB, val: p.observaciones || '' },
          minutas: { type: db.oracledb.CLOB, val: JSON.stringify(p.minutas || []) },
          ticketsMantis: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsMantis || []) },
          ticketsTaiga: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsTaiga || []) },
          ticketsJira: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsJira || []) },
          ticketsGitlab: { type: db.oracledb.CLOB, val: JSON.stringify(p.ticketsGitlab || []) },
          kanbanPinned: p.kanbanPinned ? 1 : 0,
          createdAt: p.createdAt || new Date().toISOString(),
          updatedAt: p.updatedAt || new Date().toISOString()
        });
      }
    }

    // 4. Migrate History
    if (Array.isArray(history)) {
      for (const h of history) {
        const query = `
          INSERT INTO HISTORIAL (ID, ACCION, ENTIDAD, ENTIDAD_ID, DESCRIPCION, TIMESTAMP)
          VALUES (:id, :action, :entity, :entityId, :description, :timestamp)
        `;
        await db.execute(query, {
          id: h.id,
          action: h.action,
          entity: h.entity,
          entityId: h.entityId || null,
          description: h.description,
          timestamp: h.timestamp || new Date().toISOString()
        });
      }
    }

    // 5. Migrate Settings
    if (settings) {
      await db.execute('INSERT INTO CONFIGURACION (CLAVE, VALOR) VALUES (:key, :value)', {
        key: 'notif_settings',
        value: JSON.stringify(settings)
      });
    }

    console.log('Migration completed successfully!');
    res.json({ success: true, message: 'All data successfully migrated to Oracle Database.' });
  } catch (err) {
    console.error('Migration failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check endpoint (public, no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// Start Server and Database Connection
db.initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Backend API Server running at http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('Failed to initialize database connection pool.', err);
    process.exit(1);
  });
