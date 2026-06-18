/* ============================================
   PROJECTS VIEW - ABM (Alta/Baja/Modificación)
   ============================================ */

const ProjectsView = (() => {
  let currentFilter = 'todos';
  let searchQuery = '';
  let sortField = 'updatedAt';
  let sortDir = 'desc';
  let editingMinutaId = null;
  let _pendingMinutaFile = undefined; // undefined = no change, null = cleared, object = new file

  // Priority weight for proper sort order
  const PRIO_WEIGHT = { critica: 0, alta: 1, media: 2, baja: 3 };

  // Custom drag-and-drop order per filter key (saved in localStorage)
  const DRAG_ORDER_KEY = 'projects_drag_order';
  let dragOrderMap = {}; // { filterKey: [id, id, id, ...] }

  function loadDragOrder() {
    try {
      dragOrderMap = JSON.parse(localStorage.getItem(DRAG_ORDER_KEY) || '{}');
    } catch (e) { dragOrderMap = {}; }
  }
  function saveDragOrder() {
    localStorage.setItem(DRAG_ORDER_KEY, JSON.stringify(dragOrderMap));
  }
  function getDragOrderKey() {
    return `${currentFilter}||${searchQuery}`;
  }

  loadDragOrder();

  function render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Gestión de Proyectos</h2>
          <p class="section-subtitle">Alta, baja y modificación de programas en desarrollo</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary" onclick="ProjectsView.exportCSV()">
            <i data-lucide="download" style="width:16px;height:16px;"></i> Exportar
          </button>
          ${AuthManager.hasRole('superadmin', 'admin') ? `
          <button class="btn btn-primary" onclick="ProjectsView.openForm()">
            <i data-lucide="plus" style="width:16px;height:16px;"></i> Nuevo Proyecto
          </button>` : ''}
        </div>
      </div>

      <!-- Filters -->
      <div class="filter-chips mb-4" id="project-filters">
        <button class="filter-chip ${currentFilter === 'todos' ? 'active' : ''}" onclick="ProjectsView.setFilter('todos')">Todos</button>
        ${DataStore.STATUSES.filter(s => s.id !== 'archivado').map(s => `
          <button class="filter-chip ${currentFilter === s.id ? 'active' : ''}" onclick="ProjectsView.setFilter('${s.id}')">${s.label}</button>
        `).join('')}
        <span style="width:1px;background:var(--border-subtle);margin:0 6px;align-self:stretch;display:inline-block;"></span>
        <button class="filter-chip ${currentFilter === 'archivado' ? 'active' : ''}" onclick="ProjectsView.setFilter('archivado')" style="opacity:0.7; ${currentFilter === 'archivado' ? '' : 'border-style:dashed;'}">
          <i data-lucide="archive" style="width:12px;height:12px;margin-right:4px;vertical-align:middle;pointer-events:none;"></i>Archivados
          <span style="margin-left:4px;background:rgba(148,163,184,0.15);border-radius:10px;padding:0 6px;font-size:0.7rem;">
            ${DataStore.getProjects().filter(p => p.estado === 'archivado').length}
          </span>
        </button>
      </div>

      <!-- Table -->
      <div class="data-table-container animate-slide-up">
        <div class="data-table-toolbar">
          <div class="data-table-toolbar-left">
            <div class="header-search">
              <i data-lucide="search" style="width:14px;height:14px;"></i>
              <input type="text" placeholder="Buscar proyecto..." id="project-search-input"
                     value="${searchQuery}" oninput="ProjectsView.setSearch(this.value)">
            </div>
          </div>
          <div class="data-table-toolbar-right">
            <span style="font-size: 0.75rem; color: var(--text-tertiary);" id="project-count"></span>
          </div>
        </div>
        <div class="data-table-wrapper">
          <table class="data-table" id="projects-table">
            <thead>
              <tr>
                <th onclick="ProjectsView.setSort('nombre')" style="width: 25%; min-width: 180px;">Proyecto ${sortIcon('nombre')}</th>
                <th onclick="ProjectsView.setSort('expediente')" style="width: 12%; min-width: 100px;">Expediente ${sortIcon('expediente')}</th>
                <th onclick="ProjectsView.setSort('estado')">Estado ${sortIcon('estado')}</th>
                <th onclick="ProjectsView.setSort('prioridad')">Prioridad ${sortIcon('prioridad')}</th>
                <th onclick="ProjectsView.setSort('porcentajeAvance')">Avance ${sortIcon('porcentajeAvance')}</th>
                <th onclick="ProjectsView.setSort('dificultad')">Dificultad ${sortIcon('dificultad')}</th>
                <th>Responsable</th>
                <th onclick="ProjectsView.setSort('fechaEstimadaFin')">Entrega (Est/Real) ${sortIcon('fechaEstimadaFin')}</th>
                <th style="width:80px;">Acciones</th>
              </tr>
            </thead>
            <tbody id="projects-tbody"></tbody>
          </table>
        </div>
        <div class="data-table-footer" id="projects-footer"></div>
      </div>

      <!-- Project Form Modal -->
      <div class="modal-overlay" id="project-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 class="modal-title" id="project-modal-title">Nuevo Proyecto</h3>
            <button class="modal-close" onclick="ProjectsView.closeForm()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body" id="project-modal-body"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="ProjectsView.closeForm()">Cancelar</button>
            <button class="btn btn-primary" id="project-save-btn" onclick="ProjectsView.saveProject()">
              <i data-lucide="save" style="width:16px;height:16px;"></i> Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Confirm Modal -->
      <div class="modal-overlay" id="delete-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title">Confirmar Eliminación</h3>
            <button class="modal-close" onclick="ProjectsView.closeDelete()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="confirm-dialog">
              <div class="confirm-dialog-icon">🗑️</div>
              <h3>¿Eliminar este proyecto?</h3>
              <p id="delete-project-name">Esta acción no se puede deshacer.</p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="ProjectsView.closeDelete()">Cancelar</button>
            <button class="btn btn-danger" id="delete-confirm-btn" onclick="ProjectsView.confirmDelete()">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Eliminar
            </button>
          </div>
        </div>
      </div>

      <!-- Detail Modal -->
      <div class="modal-overlay" id="detail-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 class="modal-title" id="detail-modal-title">Detalle del Proyecto</h3>
            <button class="modal-close" onclick="ProjectsView.closeDetail()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body" id="detail-modal-body"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="ProjectsView.closeDetail()">Cerrar</button>
            <button class="btn btn-primary" id="detail-edit-btn" style="display:none;">
              <i data-lucide="pencil" style="width:16px;height:16px;"></i> Editar
            </button>
          </div>
        </div>
      </div>
    `;

    renderTableRows();
    if (window.lucide) lucide.createIcons();
  }

  function sortIcon(field) {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? '↑' : '↓';
  }

  function getFilteredProjects() {
    let projects = DataStore.getProjects();

    // Exclude archived from all views EXCEPT when explicitly filtering by 'archivado'
    if (currentFilter !== 'archivado') {
      projects = projects.filter(p => p.estado !== 'archivado');
    }

    // Filter by status
    if (currentFilter !== 'todos') {
      projects = projects.filter(p => p.estado === currentFilter);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      projects = projects.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.expediente.toLowerCase().includes(q) ||
        p.areaSolicitante.toLowerCase().includes(q) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(q)) ||
        (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Check if a custom drag order exists for this view
    const orderKey = getDragOrderKey();
    const customOrder = dragOrderMap[orderKey];
    if (customOrder && customOrder.length > 0) {
      const orderIndex = {};
      customOrder.forEach((id, i) => { orderIndex[id] = i; });
      projects.sort((a, b) => {
        const ia = orderIndex[a.id] !== undefined ? orderIndex[a.id] : 9999;
        const ib = orderIndex[b.id] !== undefined ? orderIndex[b.id] : 9999;
        return ia - ib;
      });
      return projects;
    }

    // Sort
    projects.sort((a, b) => {
      if (sortField === 'prioridad') {
        const wa = PRIO_WEIGHT[a.prioridad] !== undefined ? PRIO_WEIGHT[a.prioridad] : 99;
        const wb = PRIO_WEIGHT[b.prioridad] !== undefined ? PRIO_WEIGHT[b.prioridad] : 99;
        return sortDir === 'asc' ? wa - wb : wb - wa;
      }
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return projects;
  }

  function renderTableRows() {
    const projects = getFilteredProjects();
    const tbody = document.getElementById('projects-tbody');
    const counter = document.getElementById('project-count');
    const footer = document.getElementById('projects-footer');
    if (!tbody) return;

    const orderKey = getDragOrderKey();
    const hasCustomOrder = dragOrderMap[orderKey] && dragOrderMap[orderKey].length > 0;

    counter.textContent = `${projects.length} proyecto${projects.length !== 1 ? 's' : ''}`;
    footer.innerHTML = `
      <span>Mostrando ${projects.length} proyecto${projects.length !== 1 ? 's' : ''}</span>
      ${hasCustomOrder ? `<button onclick="ProjectsView.clearDragOrder()" style="margin-left:12px;font-size:0.72rem;color:var(--text-tertiary);background:none;border:1px solid var(--border-subtle);border-radius:6px;padding:2px 8px;cursor:pointer;" title="Quitar orden manual">↺ Restablecer orden</button>` : ''}
    `;

    if (projects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <h3>No se encontraron proyectos</h3>
              <p>${currentFilter !== 'todos' ? 'No hay proyectos con este filtro.' : 'Creá tu primer proyecto para comenzar.'}</p>
              ${AuthManager.hasRole('superadmin', 'admin') ? `<button class="btn btn-primary" onclick="ProjectsView.openForm()">
                <i data-lucide="plus" style="width:16px;height:16px;"></i> Nuevo Proyecto
              </button>` : ''}
            </div>
          </td>
        </tr>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    tbody.innerHTML = projects.map(p => {
      const statusInfo = DataStore.getStatusInfo(p.estado);
      const prioInfo = DataStore.getPriorityInfo(p.prioridad);
      const diffInfo = DataStore.getDifficultyInfo(p.dificultad);
      const responsible = DataStore.getTeamMemberName(p.pm || p.liderTecnico);

      return `
        <tr draggable="true" data-project-id="${p.id}" class="draggable-row">
          <td style="width: 25%; min-width: 180px;">
            <div style="display:flex;align-items:flex-start;gap:6px;">
              <span class="drag-handle" title="Arrastrar para reordenar">⠿</span>
              <div style="cursor:pointer;flex:1;" onclick="ProjectsView.showDetail('${p.id}')">
                <div style="font-weight:600; color:var(--text-primary); margin-bottom:2px; white-space: normal; text-align: justify; text-justify: inter-word; word-break: break-word;" title="${p.nombre}">${p.nombre}</div>
                <div style="font-size:0.7rem; color:var(--text-tertiary);">${p.areaSolicitante || '—'}</div>
              </div>
            </div>
          </td>
          <td style="font-size:0.75rem; font-family:monospace; width: 12%; min-width: 100px;">${p.expediente || '—'}</td>
          <td><span class="badge badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span></td>
          <td><span class="badge ${prioInfo.badgeClass}">${prioInfo.label}</span></td>
          <td>
            <div class="progress-bar">
              <div class="progress-track"><div class="progress-fill" style="width:${p.porcentajeAvance}%"></div></div>
              <span class="progress-value">${p.porcentajeAvance}%</span>
            </div>
          </td>
          <td>
            <span style="color:${diffInfo.color}; font-weight:600; font-size:0.82rem;">${p.dificultad}</span>
            <span style="font-size:0.68rem; color:var(--text-tertiary); margin-left:4px;">${diffInfo.label}</span>
          </td>
          <td style="font-size:0.78rem;">${responsible}</td>
          <td style="font-size:0.78rem;">
            ${p.estado === 'produccion' 
              ? (p.fechaRealFin ? `<span style="color:var(--status-green); font-weight:600;" title="Fin Real">✓ ${formatDate(p.fechaRealFin)}</span>` : '<span style="color:var(--text-tertiary);">Sin fecha real</span>')
              : formatDate(p.fechaEstimadaFin)
            }
          </td>
          <td>
            <div class="flex gap-2">
              ${(() => {
                const canEdit = AuthManager.canEditProject(p);
                const canDelete = AuthManager.hasRole('superadmin', 'admin');
                if (!canEdit && !canDelete) return '<span style="color:var(--text-muted);font-size:0.7rem;">—</span>';
                let btns = '';
                if (canEdit && p.estado !== 'archivado') {
                  btns += `<button class="btn btn-ghost btn-icon sm" title="Archivar proyecto" onclick="event.stopPropagation(); event.preventDefault(); ProjectsView.archiveProject('${p.id}'); return false;" style="color:var(--text-tertiary); cursor:pointer; position:relative; z-index:2;"><i data-lucide="archive" style="width:14px;height:14px; pointer-events:none;"></i></button>`;
                } else if (p.estado === 'archivado') {
                  btns += '<span class="badge badge-status badge-archivado" style="font-size:0.7rem;">Archivado</span>';
                }
                if (canEdit) {
                  btns += `<button class="btn btn-ghost btn-icon sm" title="Editar" onclick="event.stopPropagation(); ProjectsView.openForm('${p.id}')"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>`;
                }
                if (canDelete) {
                  btns += `<button class="btn btn-ghost btn-icon sm" title="Eliminar" onclick="event.stopPropagation(); ProjectsView.openDelete('${p.id}')" style="color:var(--status-red);"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>`;
                }
                return btns;
              })()}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
    initDragAndDrop();
  }

  /* ── Drag & Drop ── */
  function initDragAndDrop() {
    const tbody = document.getElementById('projects-tbody');
    if (!tbody) return;

    let dragSrc = null;

    tbody.querySelectorAll('tr.draggable-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragSrc = row;
        row.classList.add('drag-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', row.dataset.projectId);
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('drag-dragging');
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (row !== dragSrc) {
          tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
          row.classList.add('drag-over');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });

      row.addEventListener('drop', e => {
        e.preventDefault();
        if (dragSrc && dragSrc !== row) {
          // Reorder in DOM
          const allRows = Array.from(tbody.querySelectorAll('tr.draggable-row'));
          const srcIdx = allRows.indexOf(dragSrc);
          const tgtIdx = allRows.indexOf(row);

          if (srcIdx < tgtIdx) {
            row.parentNode.insertBefore(dragSrc, row.nextSibling);
          } else {
            row.parentNode.insertBefore(dragSrc, row);
          }

          // Save new order
          const newOrder = Array.from(tbody.querySelectorAll('tr.draggable-row')).map(r => r.dataset.projectId);
          const orderKey = getDragOrderKey();
          dragOrderMap[orderKey] = newOrder;
          saveDragOrder();

          // Refresh footer to show reset button
          const footer = document.getElementById('projects-footer');
          if (footer) {
            footer.innerHTML = `
              <span>Mostrando ${newOrder.length} proyecto${newOrder.length !== 1 ? 's' : ''}</span>
              <button onclick="ProjectsView.clearDragOrder()" style="margin-left:12px;font-size:0.72rem;color:var(--text-tertiary);background:none;border:1px solid var(--border-subtle);border-radius:6px;padding:2px 8px;cursor:pointer;" title="Quitar orden manual">↺ Restablecer orden</button>
            `;
          }
        }
        row.classList.remove('drag-over');
      });
    });
  }

  function clearDragOrder() {
    const orderKey = getDragOrderKey();
    delete dragOrderMap[orderKey];
    saveDragOrder();
    renderTableRows();
  }

  function setFilter(filter) {
    currentFilter = filter;
    render();
  }

  function setSearch(query) {
    searchQuery = query;
    renderTableRows();
  }

  function setSort(field) {
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      // For priority, default to ascending = Crítica first
      sortDir = field === 'prioridad' ? 'asc' : 'asc';
    }
    // Clear custom drag order for this view when user applies a column sort
    const orderKey = getDragOrderKey();
    delete dragOrderMap[orderKey];
    saveDragOrder();
    render();
  }

  /* ── Form ── */
  let editingProjectId = null;
  let _pendingPdf = undefined; // undefined = no change, null = cleared, object = new file

  function onPdfSelected(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 40 * 1024 * 1024) {
      App.showToast('El PDF no debe superar los 40 MB', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      _pendingPdf = { nombre: file.name, data: e.target.result };
      const span = document.getElementById('form-pdf-filename');
      if (span) span.innerHTML = `<span style="color:var(--primary-400);">📎 ${file.name}</span> <button type="button" onclick="ProjectsView.clearPdf()" style="background:none;border:none;color:var(--status-red);cursor:pointer;font-size:0.8rem;margin-left:4px;">✕ Quitar</button>`;
    };
    reader.readAsDataURL(file);
  }

  function clearPdf() {
    _pendingPdf = null;
    const input = document.getElementById('form-notaSolicitudPdf');
    if (input) input.value = '';
    const span = document.getElementById('form-pdf-filename');
    if (span) span.innerHTML = 'Sin archivo adjunto';
  }

  function openForm(projectId = null) {
    editingProjectId = projectId;
    _pendingPdf = undefined;
    const project = projectId ? DataStore.getProjectById(projectId) : null;
    const title = project ? 'Editar Proyecto' : 'Nuevo Proyecto';
    const team = DataStore.getTeam().filter(m => m.activo);

    document.getElementById('project-modal-title').textContent = title;

    const teamOptions = team.map(m => {
      const rankPart = m.jerarquia ? `${m.jerarquia} ` : '';
      const destPart = m.destino ? ` (${m.destino})` : '';
      return `<option value="${m.id}">${rankPart}${m.nombre} ${m.apellido}${destPart} — ${m.rol}</option>`;
    }).join('');

    const devCheckboxes = team.map(m => {
      const checked = project && project.desarrolladores && project.desarrolladores.includes(m.id) ? 'checked' : '';
      const rankPart = m.jerarquia ? `${m.jerarquia} ` : '';
      const destPart = m.destino ? ` (${m.destino})` : '';
      return `
        <label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.8rem;color:var(--text-secondary);cursor:pointer;">
          <input type="checkbox" name="desarrolladores" value="${m.id}" ${checked}
                 style="accent-color:var(--primary-500);">
          ${rankPart}${m.nombre} ${m.apellido}${destPart} <span style="color:var(--text-tertiary);font-size:0.7rem;">— ${m.rol}</span>
        </label>
      `;
    }).join('');

    document.getElementById('project-modal-body').innerHTML = `
      <form id="project-form" onsubmit="return false;">
        <!-- Basic Info -->
        <h4 style="font-size:0.82rem;font-weight:600;color:var(--primary-400);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em;">Información General</h4>

        <div class="form-group">
          <label class="form-label">Nombre del Proyecto <span class="required">*</span></label>
          <input type="text" class="form-input" id="form-nombre" value="${project?.nombre || ''}" required placeholder="Ej: Sistema de Gestión de Expedientes">
        </div>

        <div class="form-group">
          <label class="form-label">Descripción</label>
          <textarea class="form-textarea" id="form-descripcion" placeholder="Descripción del proyecto...">${project?.descripcion || ''}</textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expediente <span class="form-hint">(EE-2026-...)</span></label>
            <input type="text" class="form-input" id="form-expediente" value="${project?.expediente || ''}" placeholder="Ej: EE-2026-001234">
          </div>
          <div class="form-group">
            <label class="form-label">Área Solicitante</label>
            <input type="text" class="form-input" id="form-areaSolicitante" value="${project?.areaSolicitante || ''}" placeholder="Ej: Dirección General">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nota Solicitud <span class="form-hint">(NO-2026-...) — opcional</span></label>
            <input type="text" class="form-input" id="form-notaSolicitud" value="${project?.notaSolicitud || ''}" placeholder="Ej: NO-2026-001234">
          </div>
          <div class="form-group">
            <label class="form-label">Link a Documento Anexo</label>
            <input type="url" class="form-input" id="form-linkDocumento" value="${project?.linkDocumento || ''}" placeholder="https://...">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">PDF de la Nota Solicitud <span class="form-hint">(un solo archivo, opcional)</span></label>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <label for="form-notaSolicitudPdf" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);cursor:pointer;font-size:0.82rem;color:var(--text-secondary);transition:border-color .2s;" onmouseover="this.style.borderColor='var(--primary-500)'" onmouseout="this.style.borderColor='var(--border-subtle)'">
              <i data-lucide="paperclip" style="width:14px;height:14px;color:var(--primary-400);"></i>
              Seleccionar PDF
            </label>
            <input type="file" id="form-notaSolicitudPdf" accept="application/pdf" style="display:none;" onchange="ProjectsView.onPdfSelected(this)">
            <span id="form-pdf-filename" style="font-size:0.78rem;color:var(--text-tertiary);">${project?.notaSolicitudPdf ? `<span style="color:var(--primary-400);">📎 ${project.notaSolicitudPdf.nombre}</span> <button type="button" onclick="ProjectsView.clearPdf()" style="background:none;border:none;color:var(--status-red);cursor:pointer;font-size:0.8rem;margin-left:4px;">✕ Quitar</button>` : 'Sin archivo adjunto'}</span>
          </div>
        </div>

        <!-- Status & Priority -->
        <h4 style="font-size:0.82rem;font-weight:600;color:var(--primary-400);margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Estado y Prioridad</h4>

        <div class="form-row form-row-3">
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="form-select" id="form-estado">
              ${DataStore.STATUSES.map(s => `<option value="${s.id}" ${project?.estado === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Prioridad</label>
            <select class="form-select" id="form-prioridad">
              ${DataStore.PRIORITIES.map(p => `<option value="${p.id}" ${project?.prioridad === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Sprint Actual</label>
            <input type="text" class="form-input" id="form-sprintActual" value="${project?.sprintActual || ''}" placeholder="Ej: Sprint 5">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dificultad (Fibonacci)</label>
            <select class="form-select" id="form-dificultad">
              ${DataStore.DIFFICULTY_SCALE.map(d => `<option value="${d.value}" ${project?.dificultad === d.value ? 'selected' : ''}>${d.value} — ${d.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Porcentaje de Avance: <strong id="avance-display">${project?.porcentajeAvance || 0}%</strong></label>
            <div class="form-range-container">
              <input type="range" class="form-range" id="form-porcentajeAvance" min="0" max="100" step="5" value="${project?.porcentajeAvance || 0}"
                     oninput="document.getElementById('avance-display').textContent=this.value+'%'">
              <span class="form-range-value" id="form-avance-val">${project?.porcentajeAvance || 0}%</span>
            </div>
          </div>
        </div>

        <!-- Team Assignment -->
        <h4 style="font-size:0.82rem;font-weight:600;color:var(--primary-400);margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Equipo Asignado</h4>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project Manager</label>
            <select class="form-select" id="form-pm">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Líder Técnico</label>
            <select class="form-select" id="form-liderTecnico">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Scrum Master</label>
            <select class="form-select" id="form-scrumMaster">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Product Owner</label>
            <select class="form-select" id="form-productOwner">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Analista Funcional</label>
            <select class="form-select" id="form-analistaFuncional">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">QA / Tester</label>
            <select class="form-select" id="form-qaTester">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">DBA</label>
            <select class="form-select" id="form-dba">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">UX/UI Designer</label>
            <select class="form-select" id="form-uxuiDesigner">
              <option value="">— Sin asignar —</option>
              ${teamOptions}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Otros Integrantes Asignados</label>
          <div style="background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:10px 14px;max-height:160px;overflow-y:auto;">
            ${devCheckboxes || '<span style="font-size:0.78rem;color:var(--text-tertiary);">No hay miembros del equipo registrados</span>'}
          </div>
        </div>

        <!-- Dates -->
        <h4 style="font-size:0.82rem;font-weight:600;color:var(--primary-400);margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Fechas</h4>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fecha de Solicitud</label>
            <input type="date" class="form-input" id="form-fechaSolicitud" value="${project?.fechaSolicitud || new Date().toISOString().split('T')[0]}">
          </div>
          <div class="form-group">
            <label class="form-label">Fecha Est. Inicio</label>
            <input type="date" class="form-input" id="form-fechaEstimadaInicio" value="${project?.fechaEstimadaInicio || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fecha Est. Finalización</label>
            <input type="date" class="form-input" id="form-fechaEstimadaFin" value="${project?.fechaEstimadaFin || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Fecha Real Inicio</label>
            <input type="date" class="form-input" id="form-fechaRealInicio" value="${project?.fechaRealInicio || ''}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Fecha Real Finalización</label>
            <input type="date" class="form-input" id="form-fechaRealFin" value="${project?.fechaRealFin || ''}">
          </div>
          <div class="form-group"></div>
        </div>

        <!-- Tags & Notes -->
        <h4 style="font-size:0.82rem;font-weight:600;color:var(--primary-400);margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.05em;">Etiquetas y Observaciones</h4>

        <div class="form-group">
          <label class="form-label">Etiquetas <span class="form-hint">(separadas por coma)</span></label>
          <input type="text" class="form-input" id="form-tags" value="${(project?.tags || []).join(', ')}" placeholder="Ej: api, backend, urgente">
        </div>

        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-textarea" id="form-observaciones" placeholder="Notas internas, observaciones...">${project?.observaciones || ''}</textarea>
        </div>
      </form>
    `;

    // Set selected values for selects
    if (project) {
      const fields = ['pm', 'liderTecnico', 'scrumMaster', 'productOwner', 'analistaFuncional', 'qaTester', 'dba', 'uxuiDesigner'];
      fields.forEach(f => {
        const sel = document.getElementById('form-' + f);
        if (sel && project[f]) sel.value = project[f];
      });
    }

    document.getElementById('project-modal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  function closeForm() {
    document.getElementById('project-modal').classList.remove('active');
    editingProjectId = null;
  }

  function saveProject() {
    const nombre = document.getElementById('form-nombre').value.trim();
    if (!nombre) {
      App.showToast('El nombre del proyecto es requerido', 'error');
      return;
    }

    const devCheckboxes = document.querySelectorAll('input[name="desarrolladores"]:checked');
    const desarrolladores = Array.from(devCheckboxes).map(cb => cb.value);
    const tagsRaw = document.getElementById('form-tags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    // Determine PDF value: use newly selected, keep existing, or null
    const existingProject = editingProjectId ? DataStore.getProjectById(editingProjectId) : null;
    const pdfValue = _pendingPdf !== undefined ? _pendingPdf : (existingProject?.notaSolicitudPdf || null);

    const data = {
      nombre,
      descripcion: document.getElementById('form-descripcion').value.trim(),
      expediente: document.getElementById('form-expediente').value.trim(),
      notaSolicitud: document.getElementById('form-notaSolicitud').value.trim(),
      notaSolicitudPdf: pdfValue,
      areaSolicitante: document.getElementById('form-areaSolicitante').value.trim(),
      linkDocumento: document.getElementById('form-linkDocumento').value.trim(),
      estado: document.getElementById('form-estado').value,
      prioridad: document.getElementById('form-prioridad').value,
      dificultad: parseInt(document.getElementById('form-dificultad').value),
      porcentajeAvance: parseInt(document.getElementById('form-porcentajeAvance').value),
      sprintActual: document.getElementById('form-sprintActual').value.trim(),
      pm: document.getElementById('form-pm').value,
      liderTecnico: document.getElementById('form-liderTecnico').value,
      scrumMaster: document.getElementById('form-scrumMaster').value,
      productOwner: document.getElementById('form-productOwner').value,
      analistaFuncional: document.getElementById('form-analistaFuncional').value,
      qaTester: document.getElementById('form-qaTester').value,
      dba: document.getElementById('form-dba').value,
      uxuiDesigner: document.getElementById('form-uxuiDesigner').value,
      desarrolladores,
      fechaSolicitud: document.getElementById('form-fechaSolicitud').value,
      fechaEstimadaInicio: document.getElementById('form-fechaEstimadaInicio').value,
      fechaEstimadaFin: document.getElementById('form-fechaEstimadaFin').value,
      fechaRealInicio: document.getElementById('form-fechaRealInicio').value,
      fechaRealFin: document.getElementById('form-fechaRealFin').value,
      tags,
      observaciones: document.getElementById('form-observaciones').value.trim()
    };

    if (editingProjectId) {
      DataStore.updateProject(editingProjectId, data);
      App.showToast('Proyecto actualizado correctamente', 'success');
    } else {
      DataStore.createProject(data);
      App.showToast('Proyecto creado correctamente', 'success');
    }

    _pendingPdf = undefined;
    closeForm();
    render();
    App.updateSidebarCounts();
  }

  /* ── Delete ── */
  let deletingProjectId = null;

  function openDelete(projectId) {
    deletingProjectId = projectId;
    const project = DataStore.getProjectById(projectId);
    document.getElementById('delete-project-name').innerHTML =
      `Se eliminará permanentemente <strong>"${project.nombre}"</strong>. Esta acción no se puede deshacer.`;
    document.getElementById('delete-modal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  function closeDelete() {
    document.getElementById('delete-modal').classList.remove('active');
    deletingProjectId = null;
  }

  function confirmDelete() {
    if (deletingProjectId) {
      DataStore.deleteProject(deletingProjectId);
      App.showToast('Proyecto eliminado', 'success');
      App.updateSidebarCounts();
      closeDelete();
      render();
    }
  }

  function archiveProject(projectId) {
    try {
      if (!projectId) {
        console.error('archiveProject: No projectId provided');
        return;
      }
      const confirmed = confirm('¿Estás seguro de archivar este proyecto? Dejará de aparecer en el Kanban y en la vista general.');
      if (confirmed) {
        const result = DataStore.updateProject(projectId, { estado: 'archivado' });
        if (result) {
          App.showToast('Proyecto archivado correctamente', 'success');
          App.updateSidebarCounts();
          render();
        } else {
          App.showToast('Error: No se pudo archivar el proyecto', 'error');
        }
      }
    } catch (err) {
      console.error('Error en archiveProject:', err);
      alert('Error al archivar: ' + err.message);
    }
  }

  /* ── Detail View ── */
  function showDetail(projectId) {
    const p = DataStore.getProjectById(projectId);
    if (!p) return;

    const statusInfo = DataStore.getStatusInfo(p.estado);
    const prioInfo = DataStore.getPriorityInfo(p.prioridad);
    const diffInfo = DataStore.getDifficultyInfo(p.dificultad);

    let internalHTML = '';
    let externalHTML = '';

    const fixedRoles = [
      { key: 'pm', label: 'PM' },
      { key: 'liderTecnico', label: 'Líder Técnico' },
      { key: 'scrumMaster', label: 'Scrum Master' },
      { key: 'productOwner', label: 'Product Owner' },
      { key: 'analistaFuncional', label: 'Analista Funcional' },
      { key: 'qaTester', label: 'QA / Tester' },
      { key: 'dba', label: 'DBA' },
      { key: 'uxuiDesigner', label: 'UX/UI Designer' }
    ];

    fixedRoles.forEach(r => {
      const id = p[r.key];
      let added = false;
      if (id) {
        const m = DataStore.getTeamMemberById(id);
        if (m) {
          const nameHtml = `<div><strong>${r.label}:</strong> ${DataStore.getTeamMemberName(id)}</div>`;
          if (m.isExterno) {
            externalHTML += nameHtml;
          } else {
            internalHTML += nameHtml;
          }
          added = true;
        }
      }
      if (!added) {
        internalHTML += `<div><strong>${r.label}:</strong> —</div>`;
      }
    });

    const groupedInternalOthers = {};
    const groupedExternalOthers = {};

    (p.desarrolladores || []).forEach(id => {
      const m = DataStore.getTeamMemberById(id);
      if (m) {
        const role = m.rol || 'Desarrollador';
        const name = DataStore.getTeamMemberName(id);
        if (m.isExterno) {
          if (!groupedExternalOthers[role]) groupedExternalOthers[role] = [];
          groupedExternalOthers[role].push(name);
        } else {
          if (!groupedInternalOthers[role]) groupedInternalOthers[role] = [];
          groupedInternalOthers[role].push(name);
        }
      }
    });

    const roleOrder = ['Analista Funcional', 'Desarrollador', 'QA / Tester', 'DBA', 'UX/UI Designer'];

    const appendOthers = (grouped, destHtml) => {
      let html = destHtml;
      const presentRoles = Object.keys(grouped).sort((a, b) => {
        const idxA = roleOrder.indexOf(a);
        const idxB = roleOrder.indexOf(b);
        return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
      });
      presentRoles.forEach(role => {
        const names = grouped[role];
        const roleLabel = role === 'Desarrollador' ? 'Desarrolladores' : role;
        html += `<div><strong>${roleLabel}:</strong> ${names.join(', ')}</div>`;
      });
      return html;
    };

    internalHTML = appendOthers(groupedInternalOthers, internalHTML);
    externalHTML = appendOthers(groupedExternalOthers, externalHTML);

    let externalSection = '';
    if (externalHTML !== '') {
      externalSection = `
        <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin:16px 0 8px;">Miembros Externos</h4>
        <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">
          ${externalHTML}
        </div>
      `;
    }

    document.getElementById('detail-modal-title').textContent = p.nombre;
    document.getElementById('detail-modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px;">Información General</h4>
          <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">
            <div><strong>Expediente:</strong> <span style="font-family:monospace;color:var(--primary-300);">${p.expediente || '—'}</span></div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong>Nota Solicitud:</strong>
              <span style="font-family:monospace;color:var(--primary-300);">${p.notaSolicitud || '—'}</span>
              ${p.notaSolicitudPdf ? `
                <button onclick="ProjectsView.openPdf('${p.id}')" style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.35);border-radius:6px;color:var(--primary-400);font-size:0.72rem;cursor:pointer;font-weight:600;" title="Ver PDF en el navegador"><i data-lucide="eye" style="width:12px;height:12px;"></i> Ver PDF</button>
                <button onclick="ProjectsView.downloadPdf('${p.id}')" style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;background:rgba(34,197,94,0.10);border:1px solid rgba(34,197,94,0.3);border-radius:6px;color:#4ade80;font-size:0.72rem;cursor:pointer;font-weight:600;" title="Descargar PDF con nombre correcto"><i data-lucide="download" style="width:12px;height:12px;"></i> Descargar</button>
              ` : ''}
            </div>
            <div><strong>Área Solicitante:</strong> ${p.areaSolicitante || '—'}</div>
            <div><strong>Estado:</strong> <span class="badge badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span></div>
            <div><strong>Prioridad:</strong> <span class="badge ${prioInfo.badgeClass}">${prioInfo.label}</span></div>
            <div><strong>Dificultad:</strong> <span style="color:${diffInfo.color};font-weight:600;">${p.dificultad}</span> (${diffInfo.label})</div>
            <div><strong>Sprint:</strong> ${p.sprintActual || '—'}</div>
            <div><strong>Avance:</strong>
              <div class="progress-bar" style="display:inline-flex;width:150px;vertical-align:middle;margin-left:8px;">
                <div class="progress-track"><div class="progress-fill" style="width:${p.porcentajeAvance}%"></div></div>
                <span class="progress-value">${p.porcentajeAvance}%</span>
              </div>
            </div>
          </div>
        </div>
        <div>
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px;">Equipo Asignado</h4>
          <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">
            ${internalHTML}
          </div>
          ${externalSection}

          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin:16px 0 8px;">Fechas</h4>
          <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.8;">
            <div><strong>Solicitud:</strong> ${formatDate(p.fechaSolicitud)}</div>
            <div><strong>Inicio Est.:</strong> ${formatDate(p.fechaEstimadaInicio)}</div>
            <div><strong>Fin Est.:</strong> ${formatDate(p.fechaEstimadaFin)}</div>
            <div><strong>Inicio Real:</strong> ${formatDate(p.fechaRealInicio)}</div>
            <div><strong>Fin Real:</strong> ${formatDate(p.fechaRealFin)}</div>
          </div>
        </div>
      </div>

      ${p.descripcion ? `<div style="margin-top:20px;"><h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px;">Descripción</h4><p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">${p.descripcion}</p></div>` : ''}

      ${p.observaciones ? `<div style="margin-top:16px;"><h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:8px;">Observaciones</h4><p style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">${p.observaciones}</p></div>` : ''}

      ${p.linkDocumento ? `<div style="margin-top:16px;"><a href="${p.linkDocumento}" target="_blank" class="btn btn-secondary btn-sm"><i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir Documento Anexo</a></div>` : ''}

      ${(p.tags && p.tags.length > 0) ? `<div style="margin-top:16px;display:flex;gap:6px;flex-wrap:wrap;">${p.tags.map(t => `<span class="badge" style="background:rgba(99,102,241,0.1);color:var(--primary-400);">#${t}</span>`).join('')}</div>` : ''}

      <!-- Minutas Section -->
      <div style="margin-top:28px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
            <i data-lucide="file-text" style="width:14px;height:14px;color:var(--primary-400);"></i> Minutas, Informes o documentos .PDF
            <span style="background:var(--bg-input);padding:1px 7px;border-radius:10px;font-size:0.68rem;color:var(--text-tertiary);">${(p.minutas || []).length}</span>
          </h4>
          ${AuthManager.canEditProject(p) ? `
          <button onclick="ProjectsView.toggleMinutaForm('${p.id}')" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 10px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Agregar
          </button>
          ` : ''}
        </div>
 
        <!-- Add Minuta Form (hidden by default) -->
        <div id="add-minuta-form" style="display:none;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Título <span style="color:var(--status-red);">*</span></label>
              <input type="text" class="form-input" id="minuta-titulo" placeholder="Ej: Minuta, informe o documento" style="font-size:0.8rem;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Fecha</label>
              <input type="date" class="form-input" id="minuta-fecha" value="${new Date().toISOString().split('T')[0]}" style="font-size:0.8rem;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Archivo PDF (opcional, máx 40 MB)</label>
            <input type="file" id="minuta-archivo" accept="application/pdf" style="font-size:0.78rem;color:var(--text-secondary);">
            <div id="minuta-file-status"></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="ProjectsView.toggleMinutaForm()" class="btn btn-ghost btn-sm" style="font-size:0.72rem;">Cancelar</button>
            <button id="btn-save-minuta" onclick="ProjectsView.saveMinuta('${p.id}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;">
              <i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Minuta
            </button>
          </div>
        </div>
 
        <!-- Minutas List -->
        <div id="minutas-list">
          ${(p.minutas || []).length === 0 ? `
            <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:0.78rem;">Sin minutas cargadas</div>
          ` : (p.minutas || []).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(99,102,241,0.04);border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px;">
              <div style="flex-shrink:0;width:32px;height:32px;background:rgba(99,102,241,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="${m.archivo ? 'file-text' : 'clipboard'}" style="width:16px;height:16px;color:var(--primary-400);"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.titulo}</div>
                <div style="font-size:0.68rem;color:var(--text-tertiary);">${formatDate(m.fecha)}${m.archivo ? ` · ${m.archivo.nombre}` : ''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.editMinuta('${p.id}','${m.id}')" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:5px;padding:3px 8px;color:var(--primary-400);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Editar"><i data-lucide="pencil" style="width:11px;height:11px;"></i> Editar</button>
                ` : ''}
                ${m.archivo ? `
                  <button onclick="ProjectsView.openMinutaPdf('${p.id}','${m.id}')" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:5px;padding:3px 8px;color:var(--primary-400);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Ver PDF"><i data-lucide="eye" style="width:11px;height:11px;"></i> Ver</button>
                ` : ''}
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.deleteMinuta('${p.id}','${m.id}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;padding:3px 8px;color:var(--status-red);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Eliminar"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
 
      <!-- Tickets Mantis Section -->
      <div style="margin-top:24px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
            <i data-lucide="bug" style="width:14px;height:14px;color:#f59e0b;"></i> Mantis
            <span style="background:var(--bg-input);padding:1px 7px;border-radius:10px;font-size:0.68rem;color:var(--text-tertiary);">${(p.ticketsMantis || []).length}</span>
          </h4>
          ${AuthManager.canEditProject(p) ? `
          <button onclick="ProjectsView.toggleTicketForm('${p.id}')" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 10px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Agregar
          </button>
          ` : ''}
        </div>
 
        <!-- Add Ticket Form (hidden by default) -->
        <div id="add-ticket-form" style="display:none;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">URL del Ticket</label>
              <input type="url" class="form-input" id="ticket-url" placeholder="https://mantis.ejemplo.com/view.php?id=1234" style="font-size:0.8rem;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Fecha</label>
              <input type="date" class="form-input" id="ticket-fecha" value="${new Date().toISOString().split('T')[0]}" style="font-size:0.8rem;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Descripción breve <span style="color:var(--status-red);">*</span></label>
            <input type="text" class="form-input" id="ticket-descripcion" placeholder="Ej: Error en carga de datos del módulo X" style="font-size:0.8rem;">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="ProjectsView.toggleTicketForm()" class="btn btn-ghost btn-sm" style="font-size:0.72rem;">Cancelar</button>
            <button onclick="ProjectsView.saveTicket('${p.id}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;">
              <i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Ticket
            </button>
          </div>
        </div>
 
        <!-- Tickets List -->
        <div id="tickets-list">
          ${(p.ticketsMantis || []).length === 0 ? `
            <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:0.78rem;">Sin tickets cargados</div>
          ` : (p.ticketsMantis || []).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(245,158,11,0.04);border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px;">
              <div style="flex-shrink:0;width:32px;height:32px;background:rgba(245,158,11,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="bug" style="width:16px;height:16px;color:#f59e0b;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.descripcion}</div>
                <div style="font-size:0.68rem;color:var(--text-tertiary);">${formatDate(t.fecha)}${t.url ? ` · <a href="${t.url}" target="_blank" style="color:var(--primary-400);">Mantis ↗</a>` : ''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${t.url ? `<a href="${t.url}" target="_blank" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:5px;padding:3px 8px;color:#f59e0b;font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;text-decoration:none;" title="Abrir en Mantis"><i data-lucide="external-link" style="width:11px;height:11px;"></i> Mantis</a>` : ''}
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.deleteTicket('${p.id}','${t.id}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;padding:3px 8px;color:var(--status-red);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Eliminar"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
 
      <!-- Taiga Section -->
      <div style="margin-top:24px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
            <i data-lucide="layout" style="width:14px;height:14px;color:#14b8a6;"></i> Taiga
            <span style="background:var(--bg-input);padding:1px 7px;border-radius:10px;font-size:0.68rem;color:var(--text-tertiary);">${(p.ticketsTaiga || []).length}</span>
          </h4>
          ${AuthManager.canEditProject(p) ? `
          <button onclick="ProjectsView.toggleTaigaForm('${p.id}')" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 10px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Agregar
          </button>
          ` : ''}
        </div>
 
        <!-- Add Taiga Form (hidden by default) -->
        <div id="add-taiga-form" style="display:none;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">URL de Taiga</label>
              <input type="url" class="form-input" id="taiga-url" placeholder="https://tree.taiga.io/project/..." style="font-size:0.8rem;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Fecha</label>
              <input type="date" class="form-input" id="taiga-fecha" value="${new Date().toISOString().split('T')[0]}" style="font-size:0.8rem;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Descripción breve <span style="color:var(--status-red);">*</span></label>
            <input type="text" class="form-input" id="taiga-descripcion" placeholder="Ej: User Story, Epic o enlace al proyecto" style="font-size:0.8rem;">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="ProjectsView.toggleTaigaForm()" class="btn btn-ghost btn-sm" style="font-size:0.72rem;">Cancelar</button>
            <button onclick="ProjectsView.saveTaiga('${p.id}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;">
              <i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Enlace
            </button>
          </div>
        </div>
 
        <!-- Taiga List -->
        <div id="taiga-list">
          ${(p.ticketsTaiga || []).length === 0 ? `
            <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:0.78rem;">Sin enlaces de Taiga cargados</div>
          ` : (p.ticketsTaiga || []).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(20,184,166,0.04);border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px;">
              <div style="flex-shrink:0;width:32px;height:32px;background:rgba(20,184,166,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="layout" style="width:16px;height:16px;color:#14b8a6;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.descripcion}</div>
                <div style="font-size:0.68rem;color:var(--text-tertiary);">${formatDate(t.fecha)}${t.url ? ` · <a href="${t.url}" target="_blank" style="color:#14b8a6;">Taiga ↗</a>` : ''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${t.url ? `<a href="${t.url}" target="_blank" style="background:rgba(20,184,166,0.1);border:1px solid rgba(20,184,166,0.25);border-radius:5px;padding:3px 8px;color:#14b8a6;font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;text-decoration:none;" title="Abrir en Taiga"><i data-lucide="external-link" style="width:11px;height:11px;"></i> Taiga</a>` : ''}
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.deleteTaiga('${p.id}','${t.id}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;padding:3px 8px;color:var(--status-red);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Eliminar"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Jira Section -->
      <div style="margin-top:24px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
            <i data-lucide="trello" style="width:14px;height:14px;color:#2684ff;"></i> Jira
            <span style="background:var(--bg-input);padding:1px 7px;border-radius:10px;font-size:0.68rem;color:var(--text-tertiary);">${(p.ticketsJira || []).length}</span>
          </h4>
          ${AuthManager.canEditProject(p) ? `
          <button onclick="ProjectsView.toggleJiraForm('${p.id}')" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 10px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Agregar
          </button>
          ` : ''}
        </div>

        <!-- Add Jira Form (hidden by default) -->
        <div id="add-jira-form" style="display:none;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">URL de Jira</label>
              <input type="url" class="form-input" id="jira-url" placeholder="https://jira.ejemplo.com/browse/PROJ-123" style="font-size:0.8rem;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Fecha</label>
              <input type="date" class="form-input" id="jira-fecha" value="${new Date().toISOString().split('T')[0]}" style="font-size:0.8rem;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Descripción breve <span style="color:var(--status-red);">*</span></label>
            <input type="text" class="form-input" id="jira-descripcion" placeholder="Ej: Ticket de Jira o tarea" style="font-size:0.8rem;">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="ProjectsView.toggleJiraForm()" class="btn btn-ghost btn-sm" style="font-size:0.72rem;">Cancelar</button>
            <button onclick="ProjectsView.saveJira('${p.id}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;">
              <i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Enlace
            </button>
          </div>
        </div>

        <!-- Jira List -->
        <div id="jira-list">
          ${(p.ticketsJira || []).length === 0 ? `
            <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:0.78rem;">Sin enlaces de Jira cargados</div>
          ` : (p.ticketsJira || []).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(38,132,255,0.04);border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px;">
              <div style="flex-shrink:0;width:32px;height:32px;background:rgba(38,132,255,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="trello" style="width:16px;height:16px;color:#2684ff;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.descripcion}</div>
                <div style="font-size:0.68rem;color:var(--text-tertiary);">${formatDate(t.fecha)}${t.url ? ` · <a href="${t.url}" target="_blank" style="color:#2684ff;">Jira ↗</a>` : ''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${t.url ? `<a href="${t.url}" target="_blank" style="background:rgba(38,132,255,0.1);border:1px solid rgba(38,132,255,0.25);border-radius:5px;padding:3px 8px;color:#2684ff;font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;text-decoration:none;" title="Abrir en Jira"><i data-lucide="external-link" style="width:11px;height:11px;"></i> Jira</a>` : ''}
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.deleteJira('${p.id}','${t.id}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;padding:3px 8px;color:var(--status-red);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Eliminar"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- GitLab Section -->
      <div style="margin-top:24px;border-top:1px solid var(--border-subtle);padding-top:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:0.75rem;color:var(--text-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
            <i data-lucide="git-branch" style="width:14px;height:14px;color:#fc6d26;"></i> GitLab
            <span style="background:var(--bg-input);padding:1px 7px;border-radius:10px;font-size:0.68rem;color:var(--text-tertiary);">${(p.ticketsGitlab || []).length}</span>
          </h4>
          ${AuthManager.canEditProject(p) ? `
          <button onclick="ProjectsView.toggleGitlabForm('${p.id}')" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:4px 10px;">
            <i data-lucide="plus" style="width:12px;height:12px;"></i> Agregar
          </button>
          ` : ''}
        </div>

        <!-- Add GitLab Form (hidden by default) -->
        <div id="add-gitlab-form" style="display:none;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-md);padding:14px;margin-bottom:12px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">URL de GitLab</label>
              <input type="url" class="form-input" id="gitlab-url" placeholder="https://gitlab.ejemplo.com/..." style="font-size:0.8rem;">
            </div>
            <div>
              <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Fecha</label>
              <input type="date" class="form-input" id="gitlab-fecha" value="${new Date().toISOString().split('T')[0]}" style="font-size:0.8rem;">
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="font-size:0.72rem;color:var(--text-tertiary);display:block;margin-bottom:4px;">Descripción breve <span style="color:var(--status-red);">*</span></label>
            <input type="text" class="form-input" id="gitlab-descripcion" placeholder="Ej: Merge request, Issue o repositorio" style="font-size:0.8rem;">
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button onclick="ProjectsView.toggleGitlabForm()" class="btn btn-ghost btn-sm" style="font-size:0.72rem;">Cancelar</button>
            <button onclick="ProjectsView.saveGitlab('${p.id}')" class="btn btn-primary btn-sm" style="font-size:0.72rem;">
              <i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Enlace
            </button>
          </div>
        </div>

        <!-- GitLab List -->
        <div id="gitlab-list">
          ${(p.ticketsGitlab || []).length === 0 ? `
            <div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:0.78rem;">Sin enlaces de GitLab cargados</div>
          ` : (p.ticketsGitlab || []).sort((a, b) => b.fecha.localeCompare(a.fecha)).map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(252,109,38,0.04);border:1px solid var(--border-subtle);border-radius:8px;margin-bottom:6px;">
              <div style="flex-shrink:0;width:32px;height:32px;background:rgba(252,109,38,0.12);border-radius:8px;display:flex;align-items:center;justify-content:center;">
                <i data-lucide="git-branch" style="width:16px;height:16px;color:#fc6d26;"></i>
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:0.8rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.descripcion}</div>
                <div style="font-size:0.68rem;color:var(--text-tertiary);">${formatDate(t.fecha)}${t.url ? ` · <a href="${t.url}" target="_blank" style="color:#fc6d26;">GitLab ↗</a>` : ''}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0;">
                ${t.url ? `<a href="${t.url}" target="_blank" style="background:rgba(252,109,38,0.1);border:1px solid rgba(252,109,38,0.25);border-radius:5px;padding:3px 8px;color:#fc6d26;font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;text-decoration:none;" title="Abrir en GitLab"><i data-lucide="external-link" style="width:11px;height:11px;"></i> GitLab</a>` : ''}
                ${AuthManager.canEditProject(p) ? `
                <button onclick="ProjectsView.deleteGitlab('${p.id}','${t.id}')" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;padding:3px 8px;color:var(--status-red);font-size:0.68rem;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" title="Eliminar"><i data-lucide="trash-2" style="width:11px;height:11px;"></i></button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('detail-edit-btn').onclick = () => {
      closeDetail();
      setTimeout(() => openForm(projectId), 300);
    };

    // Show edit button only if user can edit this project
    if (AuthManager.canEditProject(p)) {
      document.getElementById('detail-edit-btn').style.display = '';
    }

    document.getElementById('detail-modal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  function closeDetail() {
    document.getElementById('detail-modal').classList.remove('active');
  }

  /* ── Export ── */
  function exportCSV() {
    const projects = getFilteredProjects();
    const headers = ['Nombre', 'Expediente', 'Área', 'Estado', 'Prioridad', 'Dificultad', 'Avance%', 'PM', 'Líder Técnico', 'Fecha Solicitud', 'Fecha Est. Fin'];
    const rows = projects.map(p => [
      p.nombre, p.expediente, p.areaSolicitante,
      DataStore.getStatusInfo(p.estado).label,
      DataStore.getPriorityInfo(p.prioridad).label,
      p.dificultad, p.porcentajeAvance,
      DataStore.getTeamMemberName(p.pm),
      DataStore.getTeamMemberName(p.liderTecnico),
      p.fechaSolicitud, p.fechaEstimadaFin
    ]);

    const csv = [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectos_div_sistemas_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    App.showToast('Archivo CSV descargado', 'success');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function openPdf(projectId) {
    const p = DataStore.getProjectById(projectId);
    if (!p || !p.notaSolicitudPdf) return;
    // Convert base64 data URL to Blob so the browser opens it in the PDF viewer
    const dataUrl = p.notaSolicitudPdf.data;
    const base64 = dataUrl.split(',')[1];
    const byteChars = atob(base64);
    const byteNums = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteNums], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const tab = window.open(blobUrl, '_blank');
    if (!tab) App.showToast('Permití las ventanas emergentes para ver el PDF', 'error');
    // Revoke after 30s to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }

  function downloadPdf(projectId) {
    const p = DataStore.getProjectById(projectId);
    if (!p || !p.notaSolicitudPdf) return;
    // Convert base64 to Blob so the filename is preserved correctly
    const dataUrl = p.notaSolicitudPdf.data;
    const base64 = dataUrl.split(',')[1];
    const byteChars = atob(base64);
    const byteNums = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteNums], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = p.notaSolicitudPdf.nombre;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }
  /* ── Minutas ── */
  function toggleMinutaForm(projectId) {
    const form = document.getElementById('add-minuta-form');
    if (!form) return;
    
    const isOpening = form.style.display === 'none';
    form.style.display = isOpening ? 'block' : 'none';
    
    if (isOpening) {
      editingMinutaId = null;
      _pendingMinutaFile = undefined;
      
      const tituloInput = document.getElementById('minuta-titulo');
      const fechaInput = document.getElementById('minuta-fecha');
      const fileInput = document.getElementById('minuta-archivo');
      const fileStatus = document.getElementById('minuta-file-status');
      const saveBtn = document.getElementById('btn-save-minuta');
      
      if (tituloInput) tituloInput.value = '';
      if (fechaInput) fechaInput.value = new Date().toISOString().split('T')[0];
      if (fileInput) fileInput.value = '';
      if (fileStatus) fileStatus.innerHTML = '';
      if (saveBtn) saveBtn.innerHTML = '<i data-lucide="save" style="width:12px;height:12px;"></i> Guardar Minuta';
      if (window.lucide) lucide.createIcons();
    }
  }

  function editMinuta(projectId, minutaId) {
    const p = DataStore.getProjectById(projectId);
    if (!p || !p.minutas) return;
    const m = p.minutas.find(x => x.id === minutaId);
    if (!m) return;
    
    editingMinutaId = minutaId;
    _pendingMinutaFile = undefined;
    
    const form = document.getElementById('add-minuta-form');
    if (form) form.style.display = 'block';
    
    const tituloInput = document.getElementById('minuta-titulo');
    const fechaInput = document.getElementById('minuta-fecha');
    const fileInput = document.getElementById('minuta-archivo');
    const fileStatus = document.getElementById('minuta-file-status');
    const saveBtn = document.getElementById('btn-save-minuta');
    
    if (tituloInput) tituloInput.value = m.titulo;
    if (fechaInput) fechaInput.value = m.fecha;
    if (fileInput) fileInput.value = '';
    
    if (fileStatus) {
      if (m.archivo) {
        fileStatus.innerHTML = `
          <div style="margin-top:6px;font-size:0.75rem;color:var(--primary-400);display:flex;align-items:center;gap:6px;">
            <span>📎 Archivo actual: <strong>${m.archivo.nombre}</strong></span>
            <button type="button" onclick="ProjectsView.clearMinutaFile()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:4px;color:var(--status-red);cursor:pointer;font-size:0.72rem;padding:1px 6px;">✕ Quitar</button>
          </div>
        `;
      } else {
        fileStatus.innerHTML = '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-tertiary);">Sin archivo adjunto</div>';
      }
    }
    
    if (saveBtn) {
      saveBtn.innerHTML = '<i data-lucide="save" style="width:12px;height:12px;"></i> Actualizar';
    }
    if (window.lucide) lucide.createIcons();
    
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearMinutaFile() {
    _pendingMinutaFile = null;
    const fileStatus = document.getElementById('minuta-file-status');
    if (fileStatus) {
      fileStatus.innerHTML = `
        <div style="margin-top:6px;font-size:0.75rem;color:var(--status-red);display:flex;align-items:center;gap:6px;">
          <span>⚠️ El archivo será eliminado al guardar</span>
          <button type="button" onclick="ProjectsView.restoreMinutaFile()" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:4px;color:var(--primary-400);cursor:pointer;font-size:0.72rem;padding:1px 6px;">Deshacer</button>
        </div>
      `;
    }
  }

  function restoreMinutaFile() {
    _pendingMinutaFile = undefined;
    const project = DataStore.getProjects().find(p => p.minutas && p.minutas.some(m => m.id === editingMinutaId));
    if (!project) return;
    const m = project.minutas.find(x => x.id === editingMinutaId);
    if (!m || !m.archivo) return;
    
    const fileStatus = document.getElementById('minuta-file-status');
    if (fileStatus) {
      fileStatus.innerHTML = `
        <div style="margin-top:6px;font-size:0.75rem;color:var(--primary-400);display:flex;align-items:center;gap:6px;">
          <span>📎 Archivo actual: <strong>${m.archivo.nombre}</strong></span>
          <button type="button" onclick="ProjectsView.clearMinutaFile()" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:4px;color:var(--status-red);cursor:pointer;font-size:0.72rem;padding:1px 6px;">✕ Quitar</button>
        </div>
      `;
    }
  }

  function saveMinuta(projectId) {
    const titulo = document.getElementById('minuta-titulo').value.trim();
    const fecha = document.getElementById('minuta-fecha').value;
    const fileInput = document.getElementById('minuta-archivo');
    
    if (!titulo) {
      App.showToast('El título es requerido', 'error');
      return;
    }
    
    const file = fileInput.files[0];
    
    const onSaved = () => {
      editingMinutaId = null;
      _pendingMinutaFile = undefined;
      showDetail(projectId);
    };

    if (file) {
      if (file.size > 40 * 1024 * 1024) {
        App.showToast('El PDF no debe superar los 40 MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = function(e) {
        const archivo = { nombre: file.name, data: e.target.result };
        let result = null;
        if (editingMinutaId) {
          result = DataStore.updateMinuta(projectId, editingMinutaId, { titulo, fecha, archivo });
          if (result) App.showToast('Documento actualizado', 'success');
        } else {
          result = DataStore.addMinuta(projectId, { titulo, fecha, archivo });
          if (result) App.showToast('Documento guardado', 'success');
        }
        
        if (!result) {
          App.showToast('Error: Límite de almacenamiento excedido. El PDF es demasiado grande o hay muchos datos guardados.', 'error');
        } else {
          onSaved();
        }
      };
      reader.readAsDataURL(file);
    } else {
      let result = null;
      if (editingMinutaId) {
        const archivoVal = _pendingMinutaFile === null ? null : undefined;
        result = DataStore.updateMinuta(projectId, editingMinutaId, { titulo, fecha, archivo: archivoVal });
        if (result) App.showToast('Documento actualizado', 'success');
      } else {
        result = DataStore.addMinuta(projectId, { titulo, fecha, archivo: null });
        if (result) App.showToast('Documento guardado', 'success');
      }
      
      if (!result) {
        App.showToast('Error: Límite de almacenamiento excedido.', 'error');
      } else {
        onSaved();
      }
    }
  }

  function deleteMinuta(projectId, minutaId) {
    if (confirm('¿Eliminar esta minuta?')) {
      DataStore.removeMinuta(projectId, minutaId);
      App.showToast('Minuta eliminada', 'success');
      showDetail(projectId);
    }
  }

  function openMinutaPdf(projectId, minutaId) {
    const p = DataStore.getProjectById(projectId);
    if (!p || !p.minutas) return;
    const m = p.minutas.find(x => x.id === minutaId);
    if (!m || !m.archivo) return;
    
    const dataUrl = m.archivo.data;
    const base64 = dataUrl.split(',')[1];
    const byteChars = atob(base64);
    const byteNums = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteNums], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    const tab = window.open(blobUrl, '_blank');
    if (!tab) App.showToast('Permití las ventanas emergentes para ver el PDF', 'error');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }

  /* ── Tickets ── */
  function toggleTicketForm() {
    const form = document.getElementById('add-ticket-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function saveTicket(projectId) {
    const descripcion = document.getElementById('ticket-descripcion').value.trim();
    const fecha = document.getElementById('ticket-fecha').value;
    const url = document.getElementById('ticket-url').value.trim();
    
    if (!descripcion) {
      App.showToast('La descripción es requerida', 'error');
      return;
    }
    
    DataStore.addTicketMantis(projectId, { descripcion, fecha, url });
    App.showToast('Ticket guardado', 'success');
    showDetail(projectId);
  }

  function deleteTicket(projectId, ticketId) {
    if (confirm('¿Eliminar este ticket?')) {
      DataStore.removeTicketMantis(projectId, ticketId);
      App.showToast('Ticket eliminado', 'success');
      showDetail(projectId);
    }
  }

  /* ── Taiga ── */
  function toggleTaigaForm() {
    const form = document.getElementById('add-taiga-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function saveTaiga(projectId) {
    const descripcion = document.getElementById('taiga-descripcion').value.trim();
    const fecha = document.getElementById('taiga-fecha').value;
    const url = document.getElementById('taiga-url').value.trim();
    
    if (!descripcion) {
      App.showToast('La descripción es requerida', 'error');
      return;
    }
    
    DataStore.addTicketTaiga(projectId, { descripcion, fecha, url });
    App.showToast('Enlace Taiga guardado', 'success');
    showDetail(projectId);
  }

  function deleteTaiga(projectId, ticketId) {
    if (confirm('¿Eliminar este enlace de Taiga?')) {
      DataStore.removeTicketTaiga(projectId, ticketId);
      App.showToast('Enlace Taiga eliminado', 'success');
      showDetail(projectId);
    }
  }

  /* ── Jira ── */
  function toggleJiraForm() {
    const form = document.getElementById('add-jira-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function saveJira(projectId) {
    const descripcion = document.getElementById('jira-descripcion').value.trim();
    const fecha = document.getElementById('jira-fecha').value;
    const url = document.getElementById('jira-url').value.trim();
    
    if (!descripcion) {
      App.showToast('La descripción es requerida', 'error');
      return;
    }
    
    DataStore.addTicketJira(projectId, { descripcion, fecha, url });
    App.showToast('Enlace Jira guardado', 'success');
    showDetail(projectId);
  }

  function deleteJira(projectId, ticketId) {
    if (confirm('¿Eliminar este enlace de Jira?')) {
      DataStore.removeTicketJira(projectId, ticketId);
      App.showToast('Enlace Jira eliminado', 'success');
      showDetail(projectId);
    }
  }

  /* ── GitLab ── */
  function toggleGitlabForm() {
    const form = document.getElementById('add-gitlab-form');
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
  }

  function saveGitlab(projectId) {
    const descripcion = document.getElementById('gitlab-descripcion').value.trim();
    const fecha = document.getElementById('gitlab-fecha').value;
    const url = document.getElementById('gitlab-url').value.trim();
    
    if (!descripcion) {
      App.showToast('La descripción es requerida', 'error');
      return;
    }
    
    DataStore.addTicketGitlab(projectId, { descripcion, fecha, url });
    App.showToast('Enlace GitLab guardado', 'success');
    showDetail(projectId);
  }

  function deleteGitlab(projectId, ticketId) {
    if (confirm('¿Eliminar este enlace de GitLab?')) {
      DataStore.removeTicketGitlab(projectId, ticketId);
      App.showToast('Enlace GitLab eliminado', 'success');
      showDetail(projectId);
    }
  }

  return {
    render,
    setFilter,
    setSearch,
    setSort,
    openForm,
    closeForm,
    saveProject,
    onPdfSelected,
    clearPdf,
    openPdf,
    downloadPdf,
    openDelete,
    closeDelete,
    confirmDelete,
    archiveProject,
    showDetail,
    closeDetail,
    exportCSV,
    clearDragOrder,
    toggleMinutaForm,
    saveMinuta,
    deleteMinuta,
    openMinutaPdf,
    editMinuta,
    clearMinutaFile,
    restoreMinutaFile,
    toggleTicketForm,
    saveTicket,
    deleteTicket,
    toggleTaigaForm,
    saveTaiga,
    deleteTaiga,
    toggleJiraForm,
    saveJira,
    deleteJira,
    toggleGitlabForm,
    saveGitlab,
    deleteGitlab
  };
})();
