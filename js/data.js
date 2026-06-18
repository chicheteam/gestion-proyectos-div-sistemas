/* ============================================
   DATA LAYER - Synchronized with Oracle Database via API
   ============================================ */

const DataStore = (() => {
  const API_BASE = '/api';

  /**
   * Authenticated fetch wrapper. Adds JWT Bearer token to all API requests.
   * Handles 401 (expired session) by redirecting to login.
   */
  function authFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    // Use AuthManager if available, otherwise try sessionStorage directly
    if (typeof AuthManager !== 'undefined' && AuthManager.getToken()) {
      options.headers['Authorization'] = `Bearer ${AuthManager.getToken()}`;
    } else {
      try {
        const stored = sessionStorage.getItem('div_sistemas_session');
        if (stored) {
          const session = JSON.parse(stored);
          if (session.token) options.headers['Authorization'] = `Bearer ${session.token}`;
        }
      } catch (e) { /* ignore */ }
    }
    return fetch(url, options).then(response => {
      if (response.status === 401) {
        sessionStorage.removeItem('div_sistemas_session');
        window.location.href = 'login.html';
        throw new Error('Sesión expirada');
      }
      return response;
    });
  }

  const STORAGE_KEYS = {
    PROJECTS: 'div_sistemas_projects',
    TEAM: 'div_sistemas_team',
    HISTORY: 'div_sistemas_history',
    SETTINGS: 'div_sistemas_settings'
  };

  /* ── In-Memory Cache ── */
  let cachedProjects = [];
  let cachedTeam = [];
  let cachedHistory = [];
  let cachedSettings = {
    deadlinesEnabled: true,
    deadlineDays: 15,
    saturatedTeamEnabled: true,
    missingDatesEnabled: true,
    inconsistenciesEnabled: true
  };

  /* ── Status Definitions ── */
  const STATUSES = [
    { id: 'solicitud', label: 'Solicitud', color: '#64748b', badgeClass: 'badge-solicitud', order: 0 },
    { id: 'backlog', label: 'Backlog', color: '#3b82f6', badgeClass: 'badge-backlog', order: 1 },
    { id: 'analisis', label: 'En Análisis', color: '#a855f7', badgeClass: 'badge-analisis', order: 2 },
    { id: 'desarrollo', label: 'En Desarrollo', color: '#06b6d4', badgeClass: 'badge-desarrollo', order: 3 },
    { id: 'testing', label: 'Testing / QA', color: '#eab308', badgeClass: 'badge-testing', order: 4 },
    { id: 'produccion', label: 'En Producción', color: '#22c55e', badgeClass: 'badge-produccion', order: 5 },
    { id: 'pausado', label: 'Pausado', color: '#f97316', badgeClass: 'badge-pausado', order: 6 },
    { id: 'cancelado', label: 'Cancelado', color: '#ef4444', badgeClass: 'badge-cancelado', order: 7 },
    { id: 'archivado', label: 'Archivado', color: '#94a3b8', badgeClass: 'badge-archivado', order: 8 }
  ];

  const PRIORITIES = [
    { id: 'critica', label: 'Crítica', color: '#ef4444', badgeClass: 'badge-priority-critica' },
    { id: 'alta', label: 'Alta', color: '#f97316', badgeClass: 'badge-priority-alta' },
    { id: 'media', label: 'Media', color: '#eab308', badgeClass: 'badge-priority-media' },
    { id: 'baja', label: 'Baja', color: '#22c55e', badgeClass: 'badge-priority-baja' }
  ];

  const DIFFICULTY_SCALE = [
    { value: 1, label: 'Muy Baja', color: '#22c55e' },
    { value: 2, label: 'Baja', color: '#4ade80' },
    { value: 3, label: 'Media', color: '#eab308' },
    { value: 5, label: 'Alta', color: '#f97316' },
    { value: 8, label: 'Muy Alta', color: '#ef4444' },
    { value: 13, label: 'Extrema', color: '#dc2626' }
  ];

  const ROLES = [
    'Product Owner',
    'Scrum Master',
    'Project Manager',
    'Líder Técnico',
    'Desarrollador',
    'Analista Funcional',
    'QA / Tester',
    'DBA',
    'UX/UI Designer'
  ];

  /* ── Helper Functions ── */
  function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
  }

  function getFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error reading from localStorage:', e);
      return null;
    }
  }

  /* ── INITIALIZE CACHE & AUTO-MIGRATION ── */
  async function initializeCache() {
    const migratedKey = 'div_sistemas_migrated_to_db';
    const isMigrated = localStorage.getItem(migratedKey) === 'true';

    if (!isMigrated) {
      // Fetch local storage contents
      const localProjects = getFromStorage(STORAGE_KEYS.PROJECTS);
      const localTeam = getFromStorage(STORAGE_KEYS.TEAM);
      const localHistory = getFromStorage(STORAGE_KEYS.HISTORY);
      const localSettings = getFromStorage('div_sistemas_notif_settings');

      if (localProjects || localTeam || localHistory || localSettings) {
        console.log('Detectados datos en localStorage. Migrando a la base de datos Oracle...');
        try {
          const response = await authFetch(`${API_BASE}/migrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projects: localProjects || [],
              team: localTeam || [],
              history: localHistory || [],
              settings: localSettings || null
            })
          });

          if (response.ok) {
            console.log('Migración exitosa del localStorage al backend.');
            localStorage.setItem(migratedKey, 'true');
            // Clear local storage keys to free browser memory
            Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
            localStorage.removeItem('div_sistemas_notif_settings');
          } else {
            console.error('La migración falló en el servidor.');
          }
        } catch (err) {
          console.error('Error de red al intentar migrar los datos locales:', err);
        }
      } else {
        localStorage.setItem(migratedKey, 'true');
      }
    }

    // Load Cache from Backend API
    try {
      const [projectsRes, teamRes, historyRes, settingsRes] = await Promise.all([
        authFetch(`${API_BASE}/projects`),
        authFetch(`${API_BASE}/team`),
        authFetch(`${API_BASE}/history`),
        authFetch(`${API_BASE}/settings`)
      ]);

      if (projectsRes.ok) cachedProjects = await projectsRes.json();
      if (teamRes.ok) cachedTeam = await teamRes.json();
      if (historyRes.ok) cachedHistory = await historyRes.json();
      if (settingsRes.ok) cachedSettings = await settingsRes.json();

      console.log('Caché sincronizado correctamente con Oracle DB.');

      // Seed if database is completely empty
      if (cachedProjects.length === 0 && cachedTeam.length === 0) {
        console.log('Base de datos vacía. Cargando datos semilla iniciales...');
        await seedSampleData();
      }
    } catch (err) {
      console.error('Error al conectarse con el API backend en localhost:3000:', err);
      // Fallback to empty states if offline so app doesn't break
      cachedProjects = [];
      cachedTeam = [];
      cachedHistory = [];
    }
  }

  /* ── SETTINGS ── */
  function getSettings() {
    return cachedSettings;
  }

  function saveSettings(settings) {
    cachedSettings = settings;
    authFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(err => console.error('Error al guardar configuración en servidor:', err));
  }

  /* ── PROJECTS CRUD ── */
  function getProjects() {
    return cachedProjects;
  }

  function getProjectById(id) {
    return cachedProjects.find(p => p.id === id);
  }

  function createProject(projectData) {
    const newProject = {
      id: generateId(),
      nombre: projectData.nombre || '',
      descripcion: projectData.descripcion || '',
      expediente: projectData.expediente || '',
      notaSolicitud: projectData.notaSolicitud || '',
      notaSolicitudPdf: projectData.notaSolicitudPdf || null,
      areaSolicitante: projectData.areaSolicitante || '',
      linkDocumento: projectData.linkDocumento || '',
      estado: projectData.estado || 'solicitud',
      prioridad: projectData.prioridad || 'media',
      dificultad: projectData.dificultad || 3,
      porcentajeAvance: projectData.porcentajeAvance || 0,
      sprintActual: projectData.sprintActual || '',
      pm: projectData.pm || '',
      liderTecnico: projectData.liderTecnico || '',
      scrumMaster: projectData.scrumMaster || '',
      productOwner: projectData.productOwner || '',
      desarrolladores: projectData.desarrolladores || [],
      fechaSolicitud: projectData.fechaSolicitud || new Date().toISOString().split('T')[0],
      fechaEstimadaInicio: projectData.fechaEstimadaInicio || '',
      fechaEstimadaFin: projectData.fechaEstimadaFin || '',
      fechaRealInicio: projectData.fechaRealInicio || '',
      fechaRealFin: projectData.fechaRealFin || '',
      tags: projectData.tags || [],
      observaciones: projectData.observaciones || '',
      minutas: projectData.minutas || [],
      ticketsMantis: projectData.ticketsMantis || [],
      ticketsTaiga: projectData.ticketsTaiga || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    cachedProjects.push(newProject);

    // Save to Database
    authFetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    }).catch(err => console.error('Error al guardar proyecto en base de datos:', err));

    addHistory('create', 'project', newProject.id, `Proyecto "${newProject.nombre}" creado`);
    return newProject;
  }

  function updateProject(id, updates) {
    const index = cachedProjects.findIndex(p => p.id === id);
    if (index === -1) return null;
    const oldProject = { ...cachedProjects[index] };

    // Auto-set fechaProduccion when transitioning to 'produccion'
    if (updates.estado === 'produccion' && oldProject.estado !== 'produccion') {
      updates.fechaProduccion = new Date().toISOString().split('T')[0];
    }
    // Clear fechaProduccion if leaving produccion to another state (except archivado)
    if (updates.estado && updates.estado !== 'produccion' && updates.estado !== 'archivado' && oldProject.estado === 'produccion') {
      updates.fechaProduccion = '';
    }

    cachedProjects[index] = { ...cachedProjects[index], ...updates, updatedAt: new Date().toISOString() };
    
    // Save to Database
    authFetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedProjects[index])
    }).catch(err => console.error('Error al actualizar proyecto en base de datos:', err));

    // Log changes
    const changes = [];
    for (const key of Object.keys(updates)) {
      if (key !== 'updatedAt' && JSON.stringify(oldProject[key]) !== JSON.stringify(updates[key])) {
        changes.push(key);
      }
    }
    if (changes.length > 0) {
      addHistory('update', 'project', id, `Proyecto "${cachedProjects[index].nombre}" actualizado: ${changes.join(', ')}`);
    }
    return cachedProjects[index];
  }

  function autoArchiveOldProductionProjects() {
    const now = new Date();
    let changed = false;

    for (let i = 0; i < cachedProjects.length; i++) {
      const p = cachedProjects[i];
      if (p.estado === 'produccion' && !p.kanbanPinned) {
        const prodDate = p.fechaProduccion || p.fechaRealFin;
        if (prodDate) {
          const start = new Date(prodDate + 'T12:00:00');
          const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) {
            cachedProjects[i].estado = 'archivado';
            cachedProjects[i].updatedAt = new Date().toISOString();
            changed = true;
            
            // Sync this single project
            authFetch(`${API_BASE}/projects/${p.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cachedProjects[i])
            }).catch(err => console.error('Error auto-archiving project:', err));

            addHistory('update', 'project', p.id, `Proyecto "${p.nombre}" archivado automáticamente (más de 60 días en producción)`);
          }
        }
      }
    }
    return changed;
  }

  function deleteProject(id) {
    const project = cachedProjects.find(p => p.id === id);
    if (!project) return false;
    cachedProjects = cachedProjects.filter(p => p.id !== id);

    // Sync deletion
    authFetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE'
    }).catch(err => console.error('Error al eliminar proyecto de base de datos:', err));

    addHistory('delete', 'project', id, `Proyecto "${project.nombre}" eliminado`);
    return true;
  }

  /* ── MINUTAS & TICKETS CRUD ── */
  function addMinuta(projectId, minutaData) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p) return null;
    if (!p.minutas) p.minutas = [];
    const minuta = {
      id: generateId(),
      fecha: minutaData.fecha || new Date().toISOString().split('T')[0],
      titulo: minutaData.titulo || '',
      archivo: minutaData.archivo || null, // { nombre, data (base64) }
      createdAt: new Date().toISOString()
    };
    p.minutas.push(minuta);
    p.updatedAt = new Date().toISOString();
    
    // Save project changes
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al guardar minuta:', err));

    addHistory('update', 'project', projectId, `Minuta "${minuta.titulo}" agregada`);
    return minuta;
  }

  function removeMinuta(projectId, minutaId) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p || !p.minutas) return false;
    p.minutas = p.minutas.filter(m => m.id !== minutaId);
    p.updatedAt = new Date().toISOString();
    
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al eliminar minuta:', err));

    addHistory('update', 'project', projectId, `Minuta eliminada`);
    return true;
  }

  function updateMinuta(projectId, minutaId, minutaData) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p || !p.minutas) return null;
    const index = p.minutas.findIndex(m => m.id === minutaId);
    if (index === -1) return null;

    const oldMinuta = p.minutas[index];
    const updatedMinuta = {
      ...oldMinuta,
      titulo: minutaData.titulo !== undefined ? minutaData.titulo : oldMinuta.titulo,
      fecha: minutaData.fecha !== undefined ? minutaData.fecha : oldMinuta.fecha,
      archivo: minutaData.archivo !== undefined ? minutaData.archivo : oldMinuta.archivo,
      updatedAt: new Date().toISOString()
    };

    p.minutas[index] = updatedMinuta;
    p.updatedAt = new Date().toISOString();

    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al actualizar minuta:', err));

    addHistory('update', 'project', projectId, `Minuta "${updatedMinuta.titulo}" actualizada`);
    return updatedMinuta;
  }

  function addTicketMantis(projectId, ticketData) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p) return null;
    if (!p.ticketsMantis) p.ticketsMantis = [];
    const ticket = {
      id: generateId(),
      fecha: ticketData.fecha || new Date().toISOString().split('T')[0],
      url: ticketData.url || '',
      descripcion: ticketData.descripcion || '',
      createdAt: new Date().toISOString()
    };
    p.ticketsMantis.push(ticket);
    p.updatedAt = new Date().toISOString();
    
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al guardar ticket Mantis:', err));

    addHistory('update', 'project', projectId, `Ticket Mantis agregado: ${ticket.descripcion.substring(0, 50)}`);
    return ticket;
  }

  function removeTicketMantis(projectId, ticketId) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p || !p.ticketsMantis) return false;
    p.ticketsMantis = p.ticketsMantis.filter(t => t.id !== ticketId);
    p.updatedAt = new Date().toISOString();
    
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al eliminar ticket Mantis:', err));

    addHistory('update', 'project', projectId, `Ticket Mantis eliminado`);
    return true;
  }

  function addTicketTaiga(projectId, ticketData) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p) return null;
    if (!p.ticketsTaiga) p.ticketsTaiga = [];
    const ticket = {
      id: generateId(),
      fecha: ticketData.fecha || new Date().toISOString().split('T')[0],
      url: ticketData.url || '',
      descripcion: ticketData.descripcion || '',
      createdAt: new Date().toISOString()
    };
    p.ticketsTaiga.push(ticket);
    p.updatedAt = new Date().toISOString();
    
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al guardar ticket Taiga:', err));

    addHistory('update', 'project', projectId, `Enlace Taiga agregado: ${ticket.descripcion.substring(0, 50)}`);
    return ticket;
  }

  function removeTicketTaiga(projectId, ticketId) {
    const p = cachedProjects.find(p => p.id === projectId);
    if (!p || !p.ticketsTaiga) return false;
    p.ticketsTaiga = p.ticketsTaiga.filter(t => t.id !== ticketId);
    p.updatedAt = new Date().toISOString();
    
    authFetch(`${API_BASE}/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    }).catch(err => console.error('Error al eliminar ticket Taiga:', err));

    addHistory('update', 'project', projectId, `Enlace Taiga eliminado`);
    return true;
  }

  /* ── TEAM CRUD ── */
  function getTeam() {
    return cachedTeam;
  }

  function getTeamMemberById(id) {
    return cachedTeam.find(m => m.id === id);
  }

  function createTeamMember(memberData) {
    const newMember = {
      id: generateId(),
      nombre: memberData.nombre || '',
      apellido: memberData.apellido || '',
      jerarquia: memberData.jerarquia || '',
      destino: memberData.destino || '',
      rol: memberData.rol || 'Desarrollador',
      email: memberData.email || '',
      celular: memberData.celular || '',
      telefonoTrabajo: memberData.telefonoTrabajo || '',
      isExterno: !!memberData.isExterno,
      activo: memberData.activo !== undefined ? memberData.activo : true,
      maxProyectos: memberData.maxProyectos || 5,
      createdAt: new Date().toISOString()
    };
    
    cachedTeam.push(newMember);

    authFetch(`${API_BASE}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMember)
    }).catch(err => console.error('Error al crear miembro en base de datos:', err));

    addHistory('create', 'team', newMember.id, `Miembro "${newMember.nombre} ${newMember.apellido}" agregado`);
    return newMember;
  }

  function updateTeamMember(id, updates) {
    const index = cachedTeam.findIndex(m => m.id === id);
    if (index === -1) return null;
    cachedTeam[index] = { ...cachedTeam[index], ...updates };
    
    authFetch(`${API_BASE}/team/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cachedTeam[index])
    }).catch(err => console.error('Error al actualizar miembro en base de datos:', err));

    addHistory('update', 'team', id, `Miembro "${cachedTeam[index].nombre} ${cachedTeam[index].apellido}" actualizado`);
    return cachedTeam[index];
  }

  function deleteTeamMember(id) {
    const member = cachedTeam.find(m => m.id === id);
    if (!member) return false;
    cachedTeam = cachedTeam.filter(m => m.id !== id);
    
    authFetch(`${API_BASE}/team/${id}`, {
      method: 'DELETE'
    }).catch(err => console.error('Error al eliminar miembro en base de datos:', err));

    addHistory('delete', 'team', id, `Miembro "${member.nombre} ${member.apellido}" eliminado`);
    return true;
  }

  /* ── HISTORY ── */
  function getHistory() {
    return cachedHistory;
  }

  function addHistory(action, entity, entityId, description) {
    const newRecord = {
      id: generateId(),
      action,
      entity,
      entityId,
      description,
      timestamp: new Date().toISOString()
    };
    
    cachedHistory.unshift(newRecord);
    if (cachedHistory.length > 200) cachedHistory.splice(200);

    authFetch(`${API_BASE}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord)
    }).catch(err => console.error('Error al guardar registro de historial:', err));
  }

  /* ── ANALYTICS (calculados localmente sobre el caché) ── */
  function getProjectsByStatus() {
    const projects = getProjects().filter(p => p.estado !== 'archivado');
    const result = {};
    STATUSES.filter(s => s.id !== 'archivado').forEach(s => { result[s.id] = 0; });
    projects.forEach(p => {
      if (result[p.estado] !== undefined) result[p.estado]++;
    });
    return result;
  }

  function getProjectsByPriority() {
    const projects = getProjects().filter(p => p.estado !== 'archivado');
    const result = {};
    PRIORITIES.forEach(p => { result[p.id] = 0; });
    projects.forEach(p => {
      if (result[p.prioridad] !== undefined) result[p.prioridad]++;
    });
    return result;
  }

  function getTeamWorkload(includeInactive = false) {
    const team = getTeam();
    const projects = getProjects();
    const activeStatuses = ['analisis', 'desarrollo', 'testing'];

    return team.filter(m => includeInactive || m.activo).map(member => {
      const fullName = member.jerarquia ? `${member.jerarquia} ${member.nombre} ${member.apellido}` : `${member.nombre} ${member.apellido}`;
      const assignedProjects = projects.filter(p =>
        activeStatuses.includes(p.estado) && (
          p.pm === member.id ||
          p.liderTecnico === member.id ||
          p.scrumMaster === member.id ||
          p.productOwner === member.id ||
          (p.desarrolladores && p.desarrolladores.includes(member.id))
        )
      );

      const count = assignedProjects.length;
      const max = member.maxProyectos || 5;
      const loadPercentage = Math.min(Math.round((count / max) * 100), 100);

      let loadLevel, loadClass, loadLabel;
      if (count <= 2) {
        loadLevel = 'green'; loadClass = 'available'; loadLabel = 'Disponible';
      } else if (count <= 3) {
        loadLevel = 'yellow'; loadClass = 'moderate'; loadLabel = 'Carga Moderada';
      } else if (count <= 4) {
        loadLevel = 'orange'; loadClass = 'high'; loadLabel = 'Carga Media';
      } else {
        loadLevel = 'red'; loadClass = 'saturated'; loadLabel = '⚠ Saturado';
      }

      return {
        member,
        fullName,
        assignedProjects,
        count,
        max,
        loadPercentage,
        loadLevel,
        loadClass,
        loadLabel
      };
    });
  }

  function getUpcomingDeadlines(days = 30) {
    const projects = getProjects();
    const now = new Date();
    const limit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return projects
      .filter(p => {
        if (!p.fechaEstimadaFin || ['produccion', 'cancelado', 'archivado'].includes(p.estado)) return false;
        const deadline = new Date(p.fechaEstimadaFin);
        return deadline <= limit;
      })
      .sort((a, b) => new Date(a.fechaEstimadaFin) - new Date(b.fechaEstimadaFin));
  }

  function getMonthlyStats(monthsCount = 6) {
    const projects = getProjects();
    const months = {};
    const now = new Date();

    let count = 6;
    if (monthsCount === 'all') {
      let oldestDate = new Date();
      projects.forEach(p => {
        const dates = [p.fechaSolicitud, p.fechaRealInicio, p.fechaEstimadaInicio, p.createdAt].filter(Boolean);
        dates.forEach(dStr => {
          const d = new Date(dStr.substring(0, 10));
          if (!isNaN(d.getTime()) && d < oldestDate) {
            oldestDate = d;
          }
        });
      });
      const diffYears = now.getFullYear() - oldestDate.getFullYear();
      const diffMonths = now.getMonth() - oldestDate.getMonth();
      count = Math.max(diffYears * 12 + diffMonths + 1, 1);
      count = Math.min(count, 60);
    } else {
      count = parseInt(monthsCount, 10) || 6;
    }

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      months[key] = { label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`, created: 0, completed: 0, desarrollo: 0 };
    }

    projects.forEach(p => {
      const createdKey = (p.fechaSolicitud || p.createdAt || '').substring(0, 7);
      const completedKey = p.fechaRealFin ? p.fechaRealFin.substring(0, 7) : null;

      if (createdKey && months[createdKey]) months[createdKey].created++;
      if (completedKey && months[completedKey]) months[completedKey].completed++;
    });

    Object.keys(months).forEach(monthKey => {
      projects.forEach(p => {
        const start = p.fechaRealInicio || p.fechaEstimadaInicio;
        if (!start) return;
        const startMonth = start.substring(0, 7);
        if (startMonth > monthKey) return;

        if (p.fechaRealFin) {
          const endMonth = p.fechaRealFin.substring(0, 7);
          if (endMonth <= monthKey) return;
        } else {
          if (['produccion', 'cancelado', 'archivado'].includes(p.estado)) {
            const estFin = p.fechaEstimadaFin;
            if (estFin) {
              const estFinMonth = estFin.substring(0, 7);
              if (estFinMonth <= monthKey) return;
            } else {
              return;
            }
          }
          if (['solicitud', 'backlog'].includes(p.estado)) {
            return;
          }
        }
        months[monthKey].desarrollo++;
      });
    });

    return months;
  }

  /* ── SEED DATA (Guardado a DB Oracle) ── */
  async function seedSampleData() {
    const teamMembers = [
      { nombre: 'Carlos', apellido: 'Méndez', rol: 'Líder Técnico', jerarquia: 'Subprefecto', destino: 'DICO', email: 'cmendez@org.gob', maxProyectos: 4 },
      { nombre: 'Laura', apellido: 'García', rol: 'Desarrollador', jerarquia: 'Oficial Principal', destino: 'DICO', email: 'lgarcia@org.gob', maxProyectos: 5 },
      { nombre: 'Martín', apellido: 'López', rol: 'Desarrollador', jerarquia: 'Cabo Primero', destino: 'DICO', email: 'mlopez@org.gob', maxProyectos: 5 },
      { nombre: 'Ana', apellido: 'Rodríguez', rol: 'Analista Funcional', jerarquia: 'Subprefecto', destino: 'DPSN', email: 'arodriguez@org.gob', maxProyectos: 4 },
      { nombre: 'Diego', apellido: 'Fernández', rol: 'Desarrollador', jerarquia: 'Oficial Auxiliar', destino: 'DTRA', email: 'dfernandez@org.gob', maxProyectos: 5 },
      { nombre: 'Sofía', apellido: 'Martínez', rol: 'QA / Tester', jerarquia: 'Cabo Segundo', destino: 'DNAU', email: 'smartinez@org.gob', maxProyectos: 6 },
      { nombre: 'Pablo', apellido: 'Torres', rol: 'Desarrollador', jerarquia: 'Cabo Segundo', destino: 'DIGE', email: 'ptorres@org.gob', maxProyectos: 5 },
      { nombre: 'Valentina', apellido: 'Ruiz', rol: 'Scrum Master', jerarquia: 'Oficial Principal', destino: 'DICO', email: 'vruiz@org.gob', maxProyectos: 4 }
    ];

    const createdMembers = [];
    for (const m of teamMembers) {
      const id = generateId();
      const newM = { ...m, id, activo: true, isExterno: false, createdAt: new Date().toISOString() };
      
      await authFetch(`${API_BASE}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newM)
      });
      createdMembers.push(newM);
    }

    const sampleProjects = [
      {
        nombre: 'Sistema de Gestión de Expedientes Digitales',
        descripcion: 'Digitalización completa del circuito de expedientes internos con firma digital y workflow de aprobación.',
        expediente: 'EXP-2025-001234',
        areaSolicitante: 'Dirección General',
        estado: 'desarrollo',
        prioridad: 'critica',
        dificultad: 8,
        porcentajeAvance: 45,
        sprintActual: 'Sprint 6',
        pm: createdMembers[0].id,
        liderTecnico: createdMembers[0].id,
        scrumMaster: createdMembers[7].id,
        desarrolladores: [createdMembers[1].id, createdMembers[2].id, createdMembers[4].id],
        fechaSolicitud: '2025-01-15',
        fechaEstimadaInicio: '2025-02-01',
        fechaEstimadaFin: '2025-09-30',
        fechaRealInicio: '2025-02-10',
        tags: ['expedientes', 'firma-digital', 'workflow']
      },
      {
        nombre: 'Portal de Autogestión Ciudadana',
        descripcion: 'Portal web para que los ciudadanos realicen trámites online, consulten estado y agenden turnos.',
        expediente: 'NOTA-2025-000891',
        areaSolicitante: 'Atención al Ciudadano',
        estado: 'analisis',
        prioridad: 'alta',
        dificultad: 13,
        porcentajeAvance: 15,
        pm: createdMembers[3].id,
        liderTecnico: createdMembers[0].id,
        productOwner: createdMembers[3].id,
        desarrolladores: [createdMembers[6].id],
        fechaSolicitud: '2025-03-20',
        fechaEstimadaInicio: '2025-06-01',
        fechaEstimadaFin: '2026-02-28',
        tags: ['portal', 'ciudadano', 'trámites', 'turnos']
      },
      {
        nombre: 'Módulo de Reportes Estadísticos RRHH',
        descripcion: 'Dashboard de indicadores de recursos humanos: ausentismo, horas extra, licencias, dotación.',
        expediente: 'EXP-2025-002341',
        areaSolicitante: 'Recursos Humanos',
        estado: 'desarrollo',
        prioridad: 'media',
        dificultad: 5,
        porcentajeAvance: 70,
        sprintActual: 'Sprint 4',
        pm: createdMembers[3].id,
        liderTecnico: createdMembers[2].id,
        scrumMaster: createdMembers[7].id,
        desarrolladores: [createdMembers[2].id],
        fechaSolicitud: '2025-02-10',
        fechaEstimadaInicio: '2025-03-15',
        fechaEstimadaFin: '2025-07-15',
        fechaRealInicio: '2025-03-20',
        tags: ['rrhh', 'reportes', 'indicadores']
      }
    ];

    for (const p of sampleProjects) {
      const id = generateId();
      const newP = {
        ...p,
        id,
        notaSolicitud: '',
        notaSolicitudPdf: null,
        linkDocumento: '',
        fechaEstimadaInicio: p.fechaEstimadaInicio || '',
        fechaEstimadaFin: p.fechaEstimadaFin || '',
        fechaRealInicio: p.fechaRealInicio || '',
        fechaRealFin: p.fechaRealFin || '',
        fechaProduccion: '',
        observaciones: '',
        minutas: [],
        ticketsMantis: [],
        ticketsTaiga: [],
        kanbanPinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await authFetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newP)
      });
    }

    // Refresh cache with the seeded database records
    const [pRes, tRes] = await Promise.all([
      authFetch(`${API_BASE}/projects`),
      authFetch(`${API_BASE}/team`)
    ]);
    if (pRes.ok) cachedProjects = await pRes.json();
    if (tRes.ok) cachedTeam = await tRes.json();
  }

  function exportData() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects: cachedProjects,
      team: cachedTeam,
      history: cachedHistory
    };
  }

  function importData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      authFetch(`${API_BASE}/migrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projects: data.projects || [],
          team: data.team || [],
          history: data.history || [],
          settings: cachedSettings
        })
      }).then(() => initializeCache());
      return true;
    } catch (e) {
      console.error('Error importing data:', e);
      return false;
    }
  }

  function clearAllData() {
    authFetch(`${API_BASE}/migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects: [], team: [], history: [], settings: null })
    }).then(() => initializeCache());
  }

  /* ── PUBLIC API ── */
  return {
    STATUSES,
    PRIORITIES,
    DIFFICULTY_SCALE,
    ROLES,
    // Projects
    getProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    // Minutas & Tickets
    addMinuta,
    updateMinuta,
    removeMinuta,
    addTicketMantis,
    removeTicketMantis,
    addTicketTaiga,
    removeTicketTaiga,
    // Team
    getTeam,
    getTeamMemberById,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    // Analytics
    getProjectsByStatus,
    getProjectsByPriority,
    getTeamWorkload,
    getUpcomingDeadlines,
    getMonthlyStats,
    // History
    getHistory,
    // Settings
    getSettings,
    saveSettings,
    // Import/Export
    exportData,
    importData,
    clearAllData,
    // Init Cache
    initializeCache,
    // Helpers
    autoArchiveOldProductionProjects,
    getTeamMemberName: (id) => {
      if (!id) return '—';
      const member = cachedTeam.find(m => m.id === id);
      if (!member) return '—';
      const rankStr = member.jerarquia ? `${member.jerarquia} ` : '';
      const destStr = member.destino ? ` (${member.destino})` : '';
      return `${rankStr}${member.nombre} ${member.apellido}${destStr}`;
    },
    getStatusInfo: (statusId) => STATUSES.find(s => s.id === statusId) || STATUSES[0],
    getPriorityInfo: (prioId) => PRIORITIES.find(p => p.id === prioId) || PRIORITIES[2],
    getDifficultyInfo: (val) => DIFFICULTY_SCALE.find(d => d.value === val) || DIFFICULTY_SCALE[2]
  };
})();
