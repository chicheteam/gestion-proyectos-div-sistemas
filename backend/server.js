const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Oracle CLOB/PDF files can be large, so we increase body limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

/* ── ENDPOINTS: PROJECTS ── */

app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM PROYECTOS');
    const projects = result.rows.map(mapProjectFromDb);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM PROYECTOS WHERE ID = :id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(mapProjectFromDb(result.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const p = req.body;
    const query = `
      INSERT INTO PROYECTOS (
        ID, NOMBRE, DESCRIPCION, EXPEDIENTE, NOTA_SOLICITUD, NOTA_SOLICITUD_PDF, AREA_SOLICITANTE, LINK_DOCUMENTO,
        ESTADO, PRIORIDAD, DIFICULTAD, PORCENTAJE_AVANCE, SPRINT_ACTUAL, PM, LIDER_TECNICO, SCRUM_MASTER, PRODUCT_OWNER,
        DESARROLLADORES, FECHA_SOLICITUD, FECHA_ESTIMADA_INICIO, FECHA_ESTIMADA_FIN, FECHA_REAL_INICIO, FECHA_REAL_FIN, FECHA_PRODUCCION,
        TAGS, OBSERVACIONES, MINUTAS, TICKETS_MANTIS, TICKETS_TAIGA, KANBAN_PINNED, CREATED_AT, UPDATED_AT
      ) VALUES (
        :id, :nombre, :descripcion, :expediente, :notaSolicitud, :notaSolicitudPdf, :areaSolicitante, :linkDocumento,
        :estado, :prioridad, :dificultad, :porcentajeAvance, :sprintActual, :pm, :liderTecnico, :scrumMaster, :productOwner,
        :desarrolladores, :fechaSolicitud, :fechaEstimadaInicio, :fechaEstimadaFin, :fechaRealInicio, :fechaRealFin, :fechaProduccion,
        :tags, :observaciones, :minutas, :ticketsMantis, :ticketsTaiga, :kanbanPinned, :createdAt, :updatedAt
      )
    `;

    const binds = {
      id: p.id,
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      expediente: p.expediente || '',
      notaSolicitud: p.notaSolicitud || '',
      notaSolicitudPdf: p.notaSolicitudPdf ? JSON.stringify(p.notaSolicitudPdf) : null,
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
      desarrolladores: JSON.stringify(p.desarrolladores || []),
      fechaSolicitud: p.fechaSolicitud || '',
      fechaEstimadaInicio: p.fechaEstimadaInicio || '',
      fechaEstimadaFin: p.fechaEstimadaFin || '',
      fechaRealInicio: p.fechaRealInicio || '',
      fechaRealFin: p.fechaRealFin || '',
      fechaProduccion: p.fechaProduccion || '',
      tags: JSON.stringify(p.tags || []),
      observaciones: p.observaciones || '',
      minutas: JSON.stringify(p.minutas || []),
      ticketsMantis: JSON.stringify(p.ticketsMantis || []),
      ticketsTaiga: JSON.stringify(p.ticketsTaiga || []),
      kanbanPinned: p.kanbanPinned ? 1 : 0,
      createdAt: p.createdAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString()
    };

    await db.execute(query, binds);
    res.status(201).json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
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
        NOTA_SOLICITUD_PDF = NVL(:notaSolicitudPdf, NOTA_SOLICITUD_PDF), -- keep PDF if not provided in updates
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
        KANBAN_PINNED = :kanbanPinned,
        UPDATED_AT = :updatedAt
      WHERE ID = :id
    `;

    // Special logic to handle PDF null/not sent (if p.notaSolicitudPdf is not defined in updates, we NVL it)
    let pdfVal = p.notaSolicitudPdf;
    if (pdfVal === undefined || pdfVal === null) {
      pdfVal = null;
    } else {
      pdfVal = JSON.stringify(pdfVal);
    }

    const binds = {
      id,
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      expediente: p.expediente || '',
      notaSolicitud: p.notaSolicitud || '',
      notaSolicitudPdf: pdfVal,
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
      desarrolladores: JSON.stringify(p.desarrolladores || []),
      fechaSolicitud: p.fechaSolicitud || '',
      fechaEstimadaInicio: p.fechaEstimadaInicio || '',
      fechaEstimadaFin: p.fechaEstimadaFin || '',
      fechaRealInicio: p.fechaRealInicio || '',
      fechaRealFin: p.fechaRealFin || '',
      fechaProduccion: p.fechaProduccion || '',
      tags: JSON.stringify(p.tags || []),
      observaciones: p.observaciones || '',
      minutas: JSON.stringify(p.minutas || []),
      ticketsMantis: JSON.stringify(p.ticketsMantis || []),
      ticketsTaiga: JSON.stringify(p.ticketsTaiga || []),
      kanbanPinned: p.kanbanPinned ? 1 : 0,
      updatedAt: new Date().toISOString()
    };

    await db.execute(query, binds);
    
    // Fetch and return updated project
    const updated = await db.execute('SELECT * FROM PROYECTOS WHERE ID = :id', [id]);
    res.json(mapProjectFromDb(updated.rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const result = await db.execute('DELETE FROM PROYECTOS WHERE ID = :id', [req.params.id]);
    res.json({ success: true, rowsAffected: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ENDPOINTS: TEAM ── */

app.get('/api/team', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM EQUIPO');
    const team = result.rows.map(mapTeamFromDb);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/team', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/team/:id', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/team/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM EQUIPO WHERE ID = :id', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ENDPOINTS: HISTORY ── */

app.get('/api/history', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM HISTORIAL ORDER BY TIMESTAMP DESC');
    const history = result.rows.map(mapHistoryFromDb);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

/* ── ENDPOINTS: CONFIGURACION (SETTINGS) ── */

app.get('/api/settings', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM CONFIGURACION WHERE CLAVE = :key', ['notif_settings']);
    if (result.rows.length === 0) {
      // Return defaults
      return res.json({
        deadlinesEnabled: true,
        deadlineDays: 15,
        saturatedTeamEnabled: true,
        missingDatesEnabled: true,
        inconsistenciesEnabled: true
      });
    }
    res.json(JSON.parse(result.rows[0].VALOR));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const settings = req.body;
    // UPSERT style configuration
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
    res.status(500).json({ error: err.message });
  }
});

/* ── ENDPOINTS: MIGRATION ── */

app.post('/api/migrate', async (req, res) => {
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
            DESARROLLADORES, FECHA_SOLICITUD, FECHA_ESTIMADA_INICIO, FECHA_ESTIMADA_FIN, FECHA_REAL_INICIO, FECHA_REAL_FIN, FECHA_PRODUCCION,
            TAGS, OBSERVACIONES, MINUTAS, TICKETS_MANTIS, TICKETS_TAIGA, KANBAN_PINNED, CREATED_AT, UPDATED_AT
          ) VALUES (
            :id, :nombre, :descripcion, :expediente, :notaSolicitud, :notaSolicitudPdf, :areaSolicitante, :linkDocumento,
            :estado, :prioridad, :dificultad, :porcentajeAvance, :sprintActual, :pm, :liderTecnico, :scrumMaster, :productOwner,
            :desarrolladores, :fechaSolicitud, :fechaEstimadaInicio, :fechaEstimadaFin, :fechaRealInicio, :fechaRealFin, :fechaProduccion,
            :tags, :observaciones, :minutas, :ticketsMantis, :ticketsTaiga, :kanbanPinned, :createdAt, :updatedAt
          )
        `;
        await db.execute(query, {
          id: p.id,
          nombre: p.nombre || '',
          descripcion: p.descripcion || '',
          expediente: p.expediente || '',
          notaSolicitud: p.notaSolicitud || '',
          notaSolicitudPdf: p.notaSolicitudPdf ? JSON.stringify(p.notaSolicitudPdf) : null,
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
          desarrolladores: JSON.stringify(p.desarrolladores || []),
          fechaSolicitud: p.fechaSolicitud || '',
          fechaEstimadaInicio: p.fechaEstimadaInicio || '',
          fechaEstimadaFin: p.fechaEstimadaFin || '',
          fechaRealInicio: p.fechaRealInicio || '',
          fechaRealFin: p.fechaRealFin || '',
          fechaProduccion: p.fechaProduccion || '',
          tags: JSON.stringify(p.tags || []),
          observaciones: p.observaciones || '',
          minutas: JSON.stringify(p.minutas || []),
          ticketsMantis: JSON.stringify(p.ticketsMantis || []),
          ticketsTaiga: JSON.stringify(p.ticketsTaiga || []),
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
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
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
