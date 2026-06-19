/* ============================================
   KANBAN VIEW - Visual Board with Drag & Drop
   ============================================ */

const KanbanView = (() => {
  const KANBAN_STATUSES = ['solicitud', 'backlog', 'analisis', 'desarrollo', 'testing', 'produccion'];
  let draggedCard = null;
  let filterPriority = 'all';
  let collapsedColumns = new Set(['backlog', 'produccion']);
  const PRODUCTION_DAYS_LIMIT = 60;
  function toggleColumn(statusId) {
    if (collapsedColumns.has(statusId)) {
      collapsedColumns.delete(statusId);
    } else {
      collapsedColumns.add(statusId);
    }
    render();
  }

  function render() {
    const container = document.getElementById('page-content');

    // Count hidden production projects (over 60 days and not pinned)
    const allProdProjects = DataStore.getProjects().filter(p => p.estado === 'produccion');
    const hiddenProd = allProdProjects.filter(p => {
      if (p.kanbanPinned) return false;
      const days = getDaysInProduction(p);
      return days !== null && days > PRODUCTION_DAYS_LIMIT;
    });

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
          const isCollapsed = collapsedColumns.has(statusId);
          
          // Production column subtitle
          let columnSubtitle = '';
          if (statusId === 'produccion') {
            columnSubtitle = '<div style="font-size:0.65rem;color:var(--text-tertiary);margin-top:2px;">Auto-oculta después de ' + PRODUCTION_DAYS_LIMIT + ' días' + (hiddenProd.length > 0 ? ' · ' + hiddenProd.length + ' oculto' + (hiddenProd.length > 1 ? 's' : '') : '') + '</div>';
          }

          return `
            <div class="kanban-column ${isCollapsed ? 'kanban-column-collapsed' : ''}" data-status="${statusId}">
              <div class="kanban-column-header">
                <div class="kanban-column-title">
                  <span class="kanban-column-dot" style="background:${statusInfo.color};"></span>
                  ${statusInfo.label}
                  ${!isCollapsed ? columnSubtitle : ''}
                </div>
                <div style="display:flex;align-items:center;gap:6px;${isCollapsed ? 'flex-direction:column;' : ''}">
                  <span class="kanban-column-count" ${isCollapsed ? 'style="transform: rotate(90deg); margin-top:10px;"' : ''}>${projects.length}</span>
                  <button class="kanban-collapse-btn" onclick="KanbanView.toggleColumn('${statusId}')" title="${isCollapsed ? 'Expandir' : 'Contraer'}">
                    <i data-lucide="${isCollapsed ? 'maximize-2' : 'minimize-2'}" style="width:14px;height:14px;"></i>
                  </button>
                </div>
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

  function getDaysInProduction(p) {
    const prodDate = p.fechaProduccion || p.fechaRealFin;
    if (!prodDate) return null;
    const now = new Date();
    const start = new Date(prodDate + 'T12:00:00');
    const diffMs = now - start;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function getProjectsForColumn(statusId) {
    let projects = DataStore.getProjects().filter(p => p.estado === statusId);

    // For production column: auto-filter by 60-day limit
    if (statusId === 'produccion') {
      projects = projects.filter(p => {
        // Always show if manually pinned
        if (p.kanbanPinned) return true;
        const days = getDaysInProduction(p);
        // Show if no date available (can't determine age) or within limit
        if (days === null) return true;
        return days <= PRODUCTION_DAYS_LIMIT;
      });
    }

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
      return '<div class="kanban-card-avatar" title="' + member.nombre + ' ' + member.apellido + '">' + initials + '</div>';
    }).join('');

    const extraCount = assignedIds.size > 4 ? '<div class="kanban-card-avatar" style="background:var(--bg-tertiary);color:var(--text-tertiary);font-size:0.55rem;">+' + (assignedIds.size - 4) + '</div>' : '';

    // Production-specific: days indicator + action buttons
    let productionInfo = '';
    if (p.estado === 'produccion') {
      const days = getDaysInProduction(p);
      const daysLabel = days !== null ? days + ' día' + (days !== 1 ? 's' : '') : '—';
      const remaining = days !== null ? Math.max(0, PRODUCTION_DAYS_LIMIT - days) : null;
      const pct = days !== null ? Math.min(100, Math.round((days / PRODUCTION_DAYS_LIMIT) * 100)) : 0;
      const barColor = pct > 80 ? 'var(--status-orange)' : pct > 50 ? '#eab308' : 'var(--status-green, #22c55e)';
      const isPinned = p.kanbanPinned;
      const canEdit = AuthManager.canEditProject(p);

      productionInfo = `
        <div style="margin-top:8px;padding:6px 8px;background:rgba(34,197,94,0.06);border-radius:6px;border:1px solid rgba(34,197,94,0.12);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:0.65rem;color:var(--text-tertiary);">En producción: <strong style="color:var(--text-secondary);">${daysLabel}</strong></span>
            <span style="font-size:0.6rem;color:var(--text-tertiary);">${remaining !== null ? (remaining > 0 ? remaining + 'd restantes' : 'Listo para archivar') : ''}</span>
          </div>
          <div style="height:3px;background:rgba(99,102,241,0.1);border-radius:2px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:2px;transition:width 0.3s;"></div>
          </div>
          ${canEdit ? `
          <div style="display:flex;gap:4px;margin-top:6px;justify-content:flex-end;">
            <button onclick="event.stopPropagation(); KanbanView.togglePin('${p.id}')" 
                    title="${isPinned ? 'Desfijar (se ocultará tras 60 días)' : 'Fijar (permanece visible siempre)'}" 
                    style="font-size:0.62rem;padding:2px 6px;border-radius:4px;border:1px solid ${isPinned ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'};background:${isPinned ? 'rgba(99,102,241,0.1)' : 'transparent'};color:${isPinned ? 'var(--primary-400)' : 'var(--text-tertiary)'};cursor:pointer;display:inline-flex;align-items:center;gap:3px;">
              <i data-lucide="${isPinned ? 'pin-off' : 'pin'}" style="width:10px;height:10px;pointer-events:none;"></i>
              ${isPinned ? 'Desfijar' : 'Fijar'}
            </button>
            <button onclick="event.stopPropagation(); KanbanView.archiveFromKanban('${p.id}')" 
                    title="Archivar proyecto" 
                    style="font-size:0.62rem;padding:2px 6px;border-radius:4px;border:1px solid rgba(148,163,184,0.2);background:transparent;color:var(--text-tertiary);cursor:pointer;display:inline-flex;align-items:center;gap:3px;">
              <i data-lucide="archive" style="width:10px;height:10px;pointer-events:none;"></i>
              Archivar
            </button>
          </div>
          ` : ''}
        </div>
      `;
    }

    const canDrag = AuthManager.canEditProject(p);

    return `
      <div class="kanban-card" draggable="${canDrag}" data-id="${p.id}"
           ondragstart="KanbanView.handleDragStart(event, '${p.id}')"
           ondragend="KanbanView.handleDragEnd(event)"
           onclick="ProjectsView.showDetail('${p.id}')"
           style="${!canDrag ? 'cursor:pointer;' : ''}">
        <div class="kanban-card-priority" style="background:${prioInfo.color};"></div>
        <div class="kanban-card-title">${p.nombre}</div>
        <div class="kanban-card-meta">
          <span class="badge ${prioInfo.badgeClass}" style="font-size:0.62rem;">${prioInfo.label}</span>
          <span class="badge" style="background:rgba(99,102,241,0.1);color:var(--primary-400);font-size:0.62rem;">
            Dif: ${p.dificultad}
          </span>
          ${p.expediente ? '<span class="badge" style="background:var(--status-gray-bg);color:var(--status-gray);font-size:0.62rem;font-family:monospace;">' + (p.expediente.length > 16 ? p.expediente.substring(0, 16) + '…' : p.expediente) + '</span>' : ''}
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
        ${productionInfo}
      </div>
    `;
  }

  /* ── Pin / Archive actions ── */
  function togglePin(projectId) {
    const project = DataStore.getProjectById(projectId);
    if (!project) return;
    if (!AuthManager.canEditProject(project)) {
      App.showToast('No tiene permisos para modificar este proyecto.', 'error');
      return;
    }
    const newPinned = !project.kanbanPinned;
    DataStore.updateProject(projectId, { kanbanPinned: newPinned });
    App.showToast(newPinned ? '"' + project.nombre + '" fijado en Kanban' : '"' + project.nombre + '" desfijado — se ocultará tras ' + PRODUCTION_DAYS_LIMIT + ' días', 'info');
    render();
  }

  function archiveFromKanban(projectId) {
    const project = DataStore.getProjectById(projectId);
    if (!project) return;
    if (!AuthManager.canEditProject(project)) {
      App.showToast('No tiene permisos para modificar este proyecto.', 'error');
      return;
    }
    if (confirm('¿Archivar "' + project.nombre + '"? Dejará de aparecer en el Kanban y en la vista general.')) {
      DataStore.updateProject(projectId, { estado: 'archivado', kanbanPinned: false });
      App.showToast('"' + project.nombre + '" archivado', 'success');
      App.updateSidebarCounts();
      render();
    }
  }

  /* ── Drag & Drop Handlers ── */
  function handleDragStart(event, projectId) {
    const project = DataStore.getProjectById(projectId);
    if (!project || !AuthManager.canEditProject(project)) {
      event.preventDefault();
      return;
    }
    draggedCard = projectId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', projectId);
  }

  function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    draggedCard = null;
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

    if (!AuthManager.canEditProject(project)) {
      App.showToast('No tiene permisos para mover este proyecto.', 'error');
      return;
    }

    const newStatusInfo = DataStore.getStatusInfo(newStatus);

    DataStore.updateProject(projectId, { estado: newStatus });
    App.showToast('"' + project.nombre + '" movido a ' + newStatusInfo.label, 'success');
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
    toggleColumn,
    setFilterPriority,
    togglePin,
    archiveFromKanban
  };
})();
