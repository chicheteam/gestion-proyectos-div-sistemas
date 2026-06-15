/* ============================================
   DATA LAYER - CRUD + localStorage
   ============================================ */

const DataStore = (() => {
  const STORAGE_KEYS = {
    PROJECTS: 'div_sistemas_projects',
    TEAM: 'div_sistemas_team',
    HISTORY: 'div_sistemas_history',
    SETTINGS: 'div_sistemas_settings'
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

  function saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  /* ── PROJECTS CRUD ── */
  function getProjects() {
    return getFromStorage(STORAGE_KEYS.PROJECTS) || [];
  }

  function getProjectById(id) {
    return getProjects().find(p => p.id === id);
  }

  function createProject(projectData) {
    const projects = getProjects();
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projects.push(newProject);
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('create', 'project', newProject.id, `Proyecto "${newProject.nombre}" creado`);
    return newProject;
  }

  function updateProject(id, updates) {
    const projects = getProjects();
    const index = projects.findIndex(p => p.id === id);
    if (index === -1) return null;
    const oldProject = { ...projects[index] };

    // Auto-set fechaProduccion when transitioning to 'produccion'
    if (updates.estado === 'produccion' && oldProject.estado !== 'produccion') {
      updates.fechaProduccion = new Date().toISOString().split('T')[0];
    }
    // Clear fechaProduccion if leaving produccion to another state (except archivado)
    if (updates.estado && updates.estado !== 'produccion' && updates.estado !== 'archivado' && oldProject.estado === 'produccion') {
      updates.fechaProduccion = '';
    }

    projects[index] = { ...projects[index], ...updates, updatedAt: new Date().toISOString() };
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);

    // Log changes
    const changes = [];
    for (const key of Object.keys(updates)) {
      if (key !== 'updatedAt' && JSON.stringify(oldProject[key]) !== JSON.stringify(updates[key])) {
        changes.push(key);
      }
    }
    if (changes.length > 0) {
      addHistory('update', 'project', id, `Proyecto "${projects[index].nombre}" actualizado: ${changes.join(', ')}`);
    }
    return projects[index];
  }

  function autoArchiveOldProductionProjects() {
    const projects = getProjects();
    const now = new Date();
    let changed = false;

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      if (p.estado === 'produccion' && !p.kanbanPinned) {
        const prodDate = p.fechaProduccion || p.fechaRealFin;
        if (prodDate) {
          const start = new Date(prodDate + 'T12:00:00');
          const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24));
          if (diffDays > 60) {
            projects[i].estado = 'archivado';
            projects[i].updatedAt = new Date().toISOString();
            changed = true;
            addHistory('update', 'project', p.id, `Proyecto "${p.nombre}" archivado automáticamente (más de 60 días en producción)`);
          }
        }
      }
    }

    if (changed) {
      saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    }
    return changed;
  }

  function deleteProject(id) {
    const projects = getProjects();
    const project = projects.find(p => p.id === id);
    if (!project) return false;
    const filtered = projects.filter(p => p.id !== id);
    saveToStorage(STORAGE_KEYS.PROJECTS, filtered);
    addHistory('delete', 'project', id, `Proyecto "${project.nombre}" eliminado`);
    return true;
  }

  /* ── MINUTAS & TICKETS CRUD ── */
  function addMinuta(projectId, minutaData) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
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
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Minuta "${minuta.titulo}" agregada`);
    return minuta;
  }

  function removeMinuta(projectId, minutaId) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p || !p.minutas) return false;
    p.minutas = p.minutas.filter(m => m.id !== minutaId);
    p.updatedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Minuta eliminada`);
    return true;
  }

  function updateMinuta(projectId, minutaId, minutaData) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
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
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Minuta "${updatedMinuta.titulo}" actualizada`);
    return updatedMinuta;
  }

  function addTicketMantis(projectId, ticketData) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
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
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Ticket Mantis agregado: ${ticket.descripcion.substring(0, 50)}`);
    return ticket;
  }

  function removeTicketMantis(projectId, ticketId) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p || !p.ticketsMantis) return false;
    p.ticketsMantis = p.ticketsMantis.filter(t => t.id !== ticketId);
    p.updatedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Ticket Mantis eliminado`);
    return true;
  }

  function addTicketTaiga(projectId, ticketData) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
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
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Enlace Taiga agregado: ${ticket.descripcion.substring(0, 50)}`);
    return ticket;
  }

  function removeTicketTaiga(projectId, ticketId) {
    const projects = getProjects();
    const p = projects.find(p => p.id === projectId);
    if (!p || !p.ticketsTaiga) return false;
    p.ticketsTaiga = p.ticketsTaiga.filter(t => t.id !== ticketId);
    p.updatedAt = new Date().toISOString();
    saveToStorage(STORAGE_KEYS.PROJECTS, projects);
    addHistory('update', 'project', projectId, `Enlace Taiga eliminado`);
    return true;
  }

  /* ── TEAM CRUD ── */
  function getTeam() {
    return getFromStorage(STORAGE_KEYS.TEAM) || [];
  }

  function getTeamMemberById(id) {
    return getTeam().find(m => m.id === id);
  }

  function createTeamMember(memberData) {
    const team = getTeam();
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
    team.push(newMember);
    saveToStorage(STORAGE_KEYS.TEAM, team);
    addHistory('create', 'team', newMember.id, `Miembro "${newMember.nombre} ${newMember.apellido}" agregado`);
    return newMember;
  }

  function updateTeamMember(id, updates) {
    const team = getTeam();
    const index = team.findIndex(m => m.id === id);
    if (index === -1) return null;
    team[index] = { ...team[index], ...updates };
    saveToStorage(STORAGE_KEYS.TEAM, team);
    addHistory('update', 'team', id, `Miembro "${team[index].nombre} ${team[index].apellido}" actualizado`);
    return team[index];
  }

  function deleteTeamMember(id) {
    const team = getTeam();
    const member = team.find(m => m.id === id);
    if (!member) return false;
    const filtered = team.filter(m => m.id !== id);
    saveToStorage(STORAGE_KEYS.TEAM, filtered);
    addHistory('delete', 'team', id, `Miembro "${member.nombre} ${member.apellido}" eliminado`);
    return true;
  }

  /* ── HISTORY ── */
  function getHistory() {
    return getFromStorage(STORAGE_KEYS.HISTORY) || [];
  }

  function addHistory(action, entity, entityId, description) {
    const history = getHistory();
    history.unshift({
      id: generateId(),
      action,
      entity,
      entityId,
      description,
      timestamp: new Date().toISOString()
    });
    // Keep only last 200 entries
    if (history.length > 200) history.splice(200);
    saveToStorage(STORAGE_KEYS.HISTORY, history);
  }

  /* ── ANALYTICS ── */
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
      // Limit to 60 months (5 years) to avoid charting lag
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
      // Use fechaSolicitud (real request date) instead of createdAt (migration timestamp)
      const createdKey = (p.fechaSolicitud || p.createdAt || '').substring(0, 7);
      const completedKey = p.fechaRealFin ? p.fechaRealFin.substring(0, 7) : null;

      if (createdKey && months[createdKey]) months[createdKey].created++;
      if (completedKey && months[completedKey]) months[completedKey].completed++;
    });

    // Calculate active development projects cumulatively for each of the 6 months
    Object.keys(months).forEach(monthKey => {
      projects.forEach(p => {
        const start = p.fechaRealInicio || p.fechaEstimadaInicio;
        if (!start) return;
        const startMonth = start.substring(0, 7);
        if (startMonth > monthKey) return;

        // If it has a real end date (finished or cancelled)
        if (p.fechaRealFin) {
          const endMonth = p.fechaRealFin.substring(0, 7);
          if (endMonth <= monthKey) return;
        } else {
          // If it is completed or cancelled but has no real end date, check estimated finish date or state
          if (['produccion', 'cancelado', 'archivado'].includes(p.estado)) {
            const estFin = p.fechaEstimadaFin;
            if (estFin) {
              const estFinMonth = estFin.substring(0, 7);
              if (estFinMonth <= monthKey) return;
            } else {
              return; // Completed/cancelled with no end dates, assume not active
            }
          }
          
          // If it's a new request or backlog, it hasn't actually started development
          if (['solicitud', 'backlog'].includes(p.estado)) {
            return;
          }
        }

        // If we reached here, the project was active in development during monthKey
        months[monthKey].desarrollo++;
      });
    });

    return months;
  }

  /* ── EXPORT / IMPORT ── */
  function exportData() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projects: getProjects(),
      team: getTeam(),
      history: getHistory()
    };
  }

  function importData(jsonData) {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (data.projects) saveToStorage(STORAGE_KEYS.PROJECTS, data.projects);
      if (data.team) saveToStorage(STORAGE_KEYS.TEAM, data.team);
      if (data.history) saveToStorage(STORAGE_KEYS.HISTORY, data.history);
      addHistory('import', 'system', null, 'Datos importados desde archivo JSON');
      return true;
    } catch (e) {
      console.error('Error importing data:', e);
      return false;
    }
  }

  function clearAllData() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  /* ── SEED DATA ── */
  function seedSampleData() {
    // Check for automatic migration of Excel data
    if (!localStorage.getItem('div_sistemas_migrated_excel')) {
      clearAllData();
      if (typeof MIGRATED_DATA !== 'undefined') {
        importData(MIGRATED_DATA);
        localStorage.setItem('div_sistemas_migrated_excel', 'true');
        return;
      }
    }

    // Check if data already exists
    if (getProjects().length > 0) return;

    // Create team members
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

    const createdMembers = teamMembers.map(m => createTeamMember(m));

    // Create projects
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
      },
      {
        nombre: 'API de Integración con AFIP',
        descripcion: 'Integración con los servicios web de AFIP para facturación electrónica y consulta de CUIT.',
        expediente: 'NOTA-2025-001567',
        areaSolicitante: 'Administración y Finanzas',
        estado: 'testing',
        prioridad: 'alta',
        dificultad: 8,
        porcentajeAvance: 85,
        pm: createdMembers[0].id,
        liderTecnico: createdMembers[0].id,
        desarrolladores: [createdMembers[4].id],
        fechaSolicitud: '2024-11-05',
        fechaEstimadaInicio: '2025-01-10',
        fechaEstimadaFin: '2025-06-30',
        fechaRealInicio: '2025-01-15',
        tags: ['api', 'afip', 'facturación', 'integración']
      },
      {
        nombre: 'Sistema de Control de Acceso Biométrico',
        descripcion: 'Control de ingreso y egreso del personal mediante huella digital y reconocimiento facial.',
        expediente: 'EXP-2025-003210',
        areaSolicitante: 'Seguridad',
        estado: 'backlog',
        prioridad: 'media',
        dificultad: 8,
        porcentajeAvance: 0,
        pm: '',
        liderTecnico: '',
        desarrolladores: [],
        fechaSolicitud: '2025-04-01',
        fechaEstimadaInicio: '',
        fechaEstimadaFin: '2026-03-31',
        tags: ['biométrico', 'acceso', 'seguridad']
      },
      {
        nombre: 'Migración Base de Datos Legacy',
        descripcion: 'Migración de las bases de datos Oracle legacy a PostgreSQL con refactorización de queries.',
        expediente: 'NOTA-2024-009812',
        areaSolicitante: 'División Sistemas',
        estado: 'desarrollo',
        prioridad: 'alta',
        dificultad: 13,
        porcentajeAvance: 30,
        sprintActual: 'Sprint 3',
        pm: createdMembers[0].id,
        liderTecnico: createdMembers[0].id,
        desarrolladores: [createdMembers[1].id, createdMembers[4].id],
        fechaSolicitud: '2024-10-15',
        fechaEstimadaInicio: '2025-02-01',
        fechaEstimadaFin: '2025-12-31',
        fechaRealInicio: '2025-03-01',
        tags: ['migración', 'base-datos', 'postgresql', 'legacy']
      },
      {
        nombre: 'App Mobile Comunicaciones Internas',
        descripcion: 'Aplicación móvil para comunicados, notificaciones y directorio interno del organismo.',
        expediente: 'EXP-2025-004100',
        areaSolicitante: 'Comunicación Institucional',
        estado: 'solicitud',
        prioridad: 'baja',
        dificultad: 5,
        porcentajeAvance: 0,
        pm: '',
        liderTecnico: '',
        desarrolladores: [],
        fechaSolicitud: '2025-05-10',
        fechaEstimadaInicio: '',
        fechaEstimadaFin: '',
        tags: ['mobile', 'comunicación', 'app']
      },
      {
        nombre: 'Automatización de Procesos de Compras',
        descripcion: 'Sistema para automatizar el circuito de compras: solicitud, cotización, orden de compra, recepción.',
        expediente: 'NOTA-2025-002100',
        areaSolicitante: 'Compras y Contrataciones',
        estado: 'analisis',
        prioridad: 'alta',
        dificultad: 8,
        porcentajeAvance: 20,
        pm: createdMembers[3].id,
        productOwner: createdMembers[3].id,
        desarrolladores: [createdMembers[6].id],
        fechaSolicitud: '2025-03-05',
        fechaEstimadaInicio: '2025-07-01',
        fechaEstimadaFin: '2026-01-31',
        tags: ['compras', 'automatización', 'workflow']
      },
      {
        nombre: 'Dashboard de Indicadores de Gestión',
        descripcion: 'Panel de control con KPIs para la Dirección: presupuesto ejecutado, metas cumplidas, etc.',
        expediente: 'EXP-2025-001890',
        areaSolicitante: 'Dirección General',
        estado: 'produccion',
        prioridad: 'critica',
        dificultad: 5,
        porcentajeAvance: 100,
        pm: createdMembers[0].id,
        liderTecnico: createdMembers[2].id,
        desarrolladores: [createdMembers[2].id],
        fechaSolicitud: '2024-09-01',
        fechaEstimadaInicio: '2024-10-15',
        fechaEstimadaFin: '2025-03-31',
        fechaRealInicio: '2024-10-20',
        fechaRealFin: '2025-04-10',
        tags: ['dashboard', 'kpi', 'dirección']
      },
      {
        nombre: 'Sistema de Mesa de Ayuda (Help Desk)',
        descripcion: 'Sistema de tickets para soporte técnico interno con SLA, categorización y base de conocimiento.',
        expediente: 'NOTA-2025-003456',
        areaSolicitante: 'División Sistemas',
        estado: 'pausado',
        prioridad: 'media',
        dificultad: 5,
        porcentajeAvance: 40,
        pm: createdMembers[7].id,
        liderTecnico: createdMembers[4].id,
        desarrolladores: [createdMembers[6].id],
        fechaSolicitud: '2025-01-20',
        fechaEstimadaInicio: '2025-04-01',
        fechaEstimadaFin: '2025-08-30',
        fechaRealInicio: '2025-04-05',
        observaciones: 'Pausado por reasignación de recursos al proyecto de Expedientes Digitales.',
        tags: ['help-desk', 'tickets', 'soporte']
      },
      {
        nombre: 'Módulo de Notificaciones Electrónicas',
        descripcion: 'Sistema de notificaciones fehacientes electrónicas con validez legal integrado al DEOX.',
        expediente: 'EXP-2025-005020',
        areaSolicitante: 'Legal y Técnica',
        estado: 'backlog',
        prioridad: 'alta',
        dificultad: 8,
        porcentajeAvance: 0,
        desarrolladores: [],
        fechaSolicitud: '2025-05-01',
        tags: ['notificaciones', 'legal', 'electrónico']
      },
      {
        nombre: 'Rediseño Portal Institucional Web',
        descripcion: 'Rediseño completo del sitio web institucional con accesibilidad WCAG 2.1 y diseño responsive.',
        expediente: 'NOTA-2025-001230',
        areaSolicitante: 'Comunicación Institucional',
        estado: 'produccion',
        prioridad: 'media',
        dificultad: 3,
        porcentajeAvance: 100,
        pm: createdMembers[7].id,
        liderTecnico: createdMembers[6].id,
        desarrolladores: [createdMembers[6].id],
        fechaSolicitud: '2024-08-10',
        fechaEstimadaInicio: '2024-09-15',
        fechaEstimadaFin: '2025-02-28',
        fechaRealInicio: '2024-09-20',
        fechaRealFin: '2025-03-05',
        tags: ['web', 'portal', 'accesibilidad', 'rediseño']
      }
    ];

    sampleProjects.forEach(p => createProject(p));
  }

  // Self-healing migration for duplicate team member IDs in localStorage
  function sanitizeLocalStorageData() {
    // --- Fix duplicate TEAM member IDs ---
    try {
      const teamDataStr = localStorage.getItem(STORAGE_KEYS.TEAM);
      if (teamDataStr) {
        let team = JSON.parse(teamDataStr);
        if (Array.isArray(team)) {
          const seenIds = new Set();
          let hasDuplicates = false;
          team.forEach(m => { if (seenIds.has(m.id)) hasDuplicates = true; seenIds.add(m.id); });

          if (hasDuplicates) {
            console.log("Sanitizing duplicate team IDs in localStorage...");
            const idCounts = {};
            const updatedTeam = team.map(m => {
              const originalId = m.id;
              idCounts[originalId] = (idCounts[originalId] || 0) + 1;
              if (idCounts[originalId] > 1) {
                let newId = originalId + '_b';
                if (m.nombre === 'Willians' && m.apellido === 'Nadia') newId = 't_18_b';
                else if (m.nombre === 'Gabriel' && m.apellido === 'Bergamini') newId = 't_22_b';
                else if (m.nombre === 'Pezzelato' && m.apellido === 'Gustavo Andres') newId = 't_30_b';
                else if (idCounts[originalId] > 2) newId = originalId + '_' + idCounts[originalId];
                m = { ...m, id: newId };
              }
              return m;
            });
            localStorage.setItem(STORAGE_KEYS.TEAM, JSON.stringify(updatedTeam));
          }
        }
      }
    } catch (e) {
      console.error("Error sanitizing duplicate team IDs in localStorage:", e);
    }

    // --- Fix duplicate PROJECT IDs ---
    try {
      const projectsDataStr = localStorage.getItem(STORAGE_KEYS.PROJECTS);
      if (projectsDataStr) {
        let projects = JSON.parse(projectsDataStr);
        if (Array.isArray(projects)) {
          const seenIds = new Set();
          let hasDuplicates = false;
          projects.forEach(p => { if (seenIds.has(p.id)) hasDuplicates = true; seenIds.add(p.id); });

          if (hasDuplicates) {
            console.log("Sanitizing duplicate project IDs in localStorage...");
            const idCounts = {};
            const updatedProjects = projects.map(p => {
              const originalId = p.id;
              idCounts[originalId] = (idCounts[originalId] || 0) + 1;
              if (idCounts[originalId] > 1) {
                const suffix = String.fromCharCode(96 + idCounts[originalId]); // _b, _c, _d...
                p = { ...p, id: originalId + '_' + suffix };
              }
              return p;
            });
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(updatedProjects));
          }
        }
      }
    } catch (e) {
      console.error("Error sanitizing duplicate project IDs in localStorage:", e);
    }
  }

  // Run one-time sanitization of local storage
  sanitizeLocalStorageData();

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
    // Import/Export
    exportData,
    importData,
    clearAllData,
    // Seed
    seedSampleData,
    // Helpers
    autoArchiveOldProductionProjects,
    getTeamMemberName: (id) => {
      if (!id) return '—';
      const member = getTeam().find(m => m.id === id);
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
