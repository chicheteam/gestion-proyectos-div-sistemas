/* ============================================
   KANBAN VIEW - Visual Board with Drag & Drop
   ============================================ */

const KanbanView = (() => {
  const KANBAN_STATUSES = ['solicitud', 'backlog', 'analisis', 'desarrollo', 'testing', 'produccion'];
  let draggedCard = null;
  let filterPriority = 'all';

  function render() {
    const container = document.getElementById('page-content');

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Tablero Kanban</h2>
          <p class="section-subtitle">Arrastrá los proyectos entre columnas para cambiar su estado</p>
        </div>
        <div class="flex gap-2">
          <div class="filter-chips">
            <button class="filter-chip ${filterPriority === 'all' ? 'active' : ''}" onclick="KanbanView.setFilterPriority('all')">Todas</button>
            ${DataStore.PRIORITIES.map(p => `
              <button class="filter-chip ${filterPriority === p.id ? 'active' : ''}" onclick="KanbanView.setFilterPriority('${p.id}')">${p.label}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="kanban-board" id="kanban-board">
        ${KANBAN_STATUSES.map(statusId => {
          const statusInfo = DataStore.getStatusInfo(statusId);
          const projects = getProjectsForColumn(statusId);
          return `
            <div class="kanban-column" data-status="${statusId}">
              <div class="kanban-column-header">
                <div class="kanban-column-title">
                  <span class="kanban-column-dot" style="background:${statusInfo.color};"></span>
                  ${statusInfo.label}
                </div>
                <span class="kanban-column-count">${projects.length}</span>
              </div>
              <div class="kanban-column-body"
                   ondragover="KanbanView.handleDragOver(event)"
                   ondragleave="KanbanView.handleDragLeave(event)"
                   ondrop="KanbanView.handleDrop(event, '${statusId}')">
                ${projects.length === 0 ? `
                  <div style="text-align:center;padding:30px 10px;color:var(--text-tertiary);font-size:0.75rem;">
                    Sin proyectos
                  </div>
                ` : projects.map(p => renderCard(p)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  function getProjectsForColumn(statusId) {
    let projects = DataStore.getProjects().filter(p => p.estado === statusId);
    if (filterPriority !== 'all') {
      projects = projects.filter(p => p.prioridad === filterPriority);
    }
    // Sort by priority weight
    const prioWeight = { critica: 0, alta: 1, media: 2, baja: 3 };
    projects.sort((a, b) => (prioWeight[a.prioridad] || 2) - (prioWeight[b.prioridad] || 2));
    return projects;
  }

  function renderCard(p) {
    const prioInfo = DataStore.getPriorityInfo(p.prioridad);
    const diffInfo = DataStore.getDifficultyInfo(p.dificultad);

    // Get assigned people initials
    const assignedIds = new Set();
    if (p.pm) assignedIds.add(p.pm);
    if (p.liderTecnico) assignedIds.add(p.liderTecnico);
    (p.desarrolladores || []).forEach(id => assignedIds.add(id));

    const avatars = Array.from(assignedIds).slice(0, 4).map(id => {
      const member = DataStore.getTeamMemberById(id);
      if (!member) return '';
      const initials = (member.nombre[0] + member.apellido[0]).toUpperCase();
      return `<div class="kanban-card-avatar" title="${member.nombre} ${member.apellido}">${initials}</div>`;
    }).join('');

    const extraCount = assignedIds.size > 4 ? `<div class="kanban-card-avatar" style="background:var(--bg-tertiary);color:var(--text-tertiary);font-size:0.55rem;">+${assignedIds.size - 4}</div>` : '';

    return `
      <div class="kanban-card" draggable="true" data-id="${p.id}"
           ondragstart="KanbanView.handleDragStart(event, '${p.id}')"
           ondragend="KanbanView.handleDragEnd(event)"
           onclick="ProjectsView.showDetail('${p.id}')">
        <div class="kanban-card-priority" style="background:${prioInfo.color};"></div>
        <div class="kanban-card-title">${p.nombre}</div>
        <div class="kanban-card-meta">
          <span class="badge ${prioInfo.badgeClass}" style="font-size:0.62rem;">${prioInfo.label}</span>
          <span class="badge" style="background:rgba(99,102,241,0.1);color:var(--primary-400);font-size:0.62rem;">
            Dif: ${p.dificultad}
          </span>
          ${p.expediente ? `<span class="badge" style="background:var(--status-gray-bg);color:var(--status-gray);font-size:0.62rem;font-family:monospace;">${p.expediente.length > 16 ? p.expediente.substring(0, 16) + '…' : p.expediente}</span>` : ''}
        </div>
        ${p.porcentajeAvance > 0 ? `
          <div class="progress-bar" style="margin-bottom:10px;">
            <div class="progress-track"><div class="progress-fill" style="width:${p.porcentajeAvance}%"></div></div>
            <span class="progress-value">${p.porcentajeAvance}%</span>
          </div>
        ` : ''}
        <div class="kanban-card-footer">
          <div class="kanban-card-avatars">${avatars}${extraCount}</div>
          ${p.fechaEstimadaFin ? `
            <div class="kanban-card-date">
              <i data-lucide="calendar" style="width:11px;height:11px;"></i>
              ${formatShortDate(p.fechaEstimadaFin)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /* ── Drag & Drop Handlers ── */
  function handleDragStart(event, projectId) {
    draggedCard = projectId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', projectId);
  }

  function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedCard = null;
    // Remove all drag-over styles
    document.querySelectorAll('.kanban-column-body').forEach(col => {
      col.classList.remove('drag-over');
    });
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
  }

  function handleDrop(event, newStatus) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    const projectId = event.dataTransfer.getData('text/plain') || draggedCard;
    if (!projectId) return;

    const project = DataStore.getProjectById(projectId);
    if (!project || project.estado === newStatus) return;

    const oldStatusInfo = DataStore.getStatusInfo(project.estado);
    const newStatusInfo = DataStore.getStatusInfo(newStatus);

    DataStore.updateProject(projectId, { estado: newStatus });
    App.showToast(`"${project.nombre}" movido a ${newStatusInfo.label}`, 'success');
    render();
    App.updateSidebarCounts();
  }

  function setFilterPriority(priority) {
    filterPriority = priority;
    render();
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  }

  return {
    render,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setFilterPriority
  };
})();
