/* ============================================
   TEAM VIEW - Workload Dashboard + ABM
   ============================================ */

const TeamView = (() => {
  let currentTab = 'workload';
  let workloadFilter = 'all';

  function render() {
    const container = document.getElementById('page-content');
    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Equipo de Desarrollo</h2>
          <p class="section-subtitle">Carga de trabajo, saturación y gestión del personal</p>
        </div>
        ${AuthManager.canManageTeam() ? `<button class="btn btn-primary" onclick="TeamView.openMemberForm()">
          <i data-lucide="user-plus" style="width:16px;height:16px;"></i> Nuevo Miembro
        </button>` : ''}
      </div>

      <div class="tabs">
        <button class="tab ${currentTab === 'workload' ? 'active' : ''}" onclick="TeamView.switchTab('workload')">
          📊 Carga de Trabajo
        </button>
        <button class="tab ${currentTab === 'members' ? 'active' : ''}" onclick="TeamView.switchTab('members')">
          👥 Miembros del Equipo
        </button>
        <button class="tab ${currentTab === 'externals' ? 'active' : ''}" onclick="TeamView.switchTab('externals')">
          🤝 Contactos Externos
        </button>
      </div>

      <div id="team-content"></div>

      <!-- Member Form Modal -->
      <div class="modal-overlay" id="member-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title" id="member-modal-title">Nuevo Miembro</h3>
            <button class="modal-close" onclick="TeamView.closeMemberForm()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body" id="member-modal-body"></div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="TeamView.closeMemberForm()">Cancelar</button>
            <button class="btn btn-primary" onclick="TeamView.saveMember()">
              <i data-lucide="save" style="width:16px;height:16px;"></i> Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Delete Member Modal -->
      <div class="modal-overlay" id="delete-member-modal">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3 class="modal-title">Confirmar Eliminación</h3>
            <button class="modal-close" onclick="TeamView.closeDeleteMember()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="confirm-dialog">
              <div class="confirm-dialog-icon">👤</div>
              <h3>¿Eliminar este miembro?</h3>
              <p id="delete-member-name"></p>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="TeamView.closeDeleteMember()">Cancelar</button>
            <button class="btn btn-danger" onclick="TeamView.confirmDeleteMember()">
              <i data-lucide="trash-2" style="width:16px;height:16px;"></i> Eliminar
            </button>
          </div>
        </div>
      </div>

      <!-- Manage Projects Modal -->
      <div class="modal-overlay" id="manage-projects-modal">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 class="modal-title" id="manage-projects-title">Gestionar Proyectos</h3>
            <button class="modal-close" onclick="TeamView.closeManageProjectsModal()">
              <i data-lucide="x" style="width:18px;height:18px;"></i>
            </button>
          </div>
          <div class="modal-body" id="manage-projects-body">
            <!-- Dynamic content loaded via JS -->
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="TeamView.closeManageProjectsModal()">
              <i data-lucide="check" style="width:16px;height:16px;"></i> Listo
            </button>
          </div>
        </div>
      </div>
    `;

    if (currentTab === 'workload') renderWorkload();
    else if (currentTab === 'externals') renderExternals();
    else renderMembers();
    if (window.lucide) lucide.createIcons();
  }

  function switchTab(tab) {
    currentTab = tab;
    workloadFilter = 'all';
    render();
  }

  /* ── Workload Dashboard ── */
  function renderWorkload() {
    const teamContent = document.getElementById('team-content');
    const workload = DataStore.getTeamWorkload().filter(w => !w.member.isExterno);

    if (workload.length === 0) {
      teamContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>Sin miembros del equipo</h3>
          <p>Agregá miembros para ver su carga de trabajo.</p>
          ${AuthManager.canManageTeam() ? `<button class="btn btn-primary" onclick="TeamView.openMemberForm()">
            <i data-lucide="user-plus" style="width:16px;height:16px;"></i> Agregar Miembro
          </button>` : ''}
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    // Summary KPIs
    const available = workload.filter(w => w.loadLevel === 'green').length;
    const moderate = workload.filter(w => w.loadLevel === 'yellow').length;
    const high = workload.filter(w => w.loadLevel === 'orange').length;
    const saturated = workload.filter(w => w.loadLevel === 'red').length;

    // Active states styling for KPI cards
    const filterGreenActive = workloadFilter === 'green';
    const filterYellowActive = workloadFilter === 'yellow';
    const filterOrangeActive = workloadFilter === 'orange';
    const filterRedActive = workloadFilter === 'red';
    const hasActiveFilter = workloadFilter !== 'all';

    const cardStyle = (level, isActive, baseColor) => {
      let style = `cursor:pointer; border-left:4px solid ${baseColor}; transition: all 0.25s ease;`;
      if (isActive) {
        style += `background: rgba(${level === 'green' ? '34, 197, 94' : level === 'yellow' ? '234, 179, 8' : level === 'orange' ? '249, 115, 22' : '239, 68, 68'}, 0.1); border-color: ${baseColor} !important; box-shadow: 0 0 16px rgba(${level === 'green' ? '34, 197, 94' : level === 'yellow' ? '234, 179, 8' : level === 'orange' ? '249, 115, 22' : '239, 68, 68'}, 0.25); transform: translateY(-2px);`;
      } else if (hasActiveFilter) {
        style += `opacity: 0.4; transform: scale(0.97);`;
      }
      return style;
    };

    // Filter workload list
    const sortedWorkload = workload.sort((a, b) => {
      const order = { red: 0, orange: 1, yellow: 2, green: 3 };
      return (order[a.loadLevel] || 3) - (order[b.loadLevel] || 3);
    });

    const filteredWorkload = workloadFilter === 'all' 
      ? sortedWorkload 
      : sortedWorkload.filter(w => w.loadLevel === workloadFilter);

    let teamCardsHTML = '';
    if (filteredWorkload.length === 0) {
      const levelNames = {
        green: 'Disponibles',
        yellow: 'Carga Moderada',
        orange: 'Carga Media',
        red: 'Saturados'
      };
      teamCardsHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px;">
          <div class="empty-state-icon">👥</div>
          <h3>Sin integrantes</h3>
          <p>No hay ningún miembro activo en la categoría <strong>${levelNames[workloadFilter].toUpperCase()}</strong>.</p>
          <button class="btn btn-secondary sm" onclick="TeamView.toggleWorkloadFilter('${workloadFilter}')" style="margin-top: 10px;">
            Quitar Filtro
          </button>
        </div>
      `;
    } else {
      teamCardsHTML = filteredWorkload.map(w => renderWorkloadCard(w)).join('');
    }

    teamContent.innerHTML = `
      <!-- Summary -->
      <div class="kpi-grid" style="margin-bottom:24px;">
        <div class="kpi-card" style="${cardStyle('green', filterGreenActive, 'var(--status-green)')}" onclick="TeamView.toggleWorkloadFilter('green')">
          <div class="kpi-card-value" style="color:var(--status-green);">${available}</div>
          <div class="kpi-card-label" style="font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-primary); font-size:0.75rem; margin-top:4px;">🟢 DISPONIBLES</div>
        </div>
        <div class="kpi-card" style="${cardStyle('yellow', filterYellowActive, 'var(--status-yellow)')}" onclick="TeamView.toggleWorkloadFilter('yellow')">
          <div class="kpi-card-value" style="color:var(--status-yellow);">${moderate}</div>
          <div class="kpi-card-label" style="font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-primary); font-size:0.75rem; margin-top:4px;">🟡 CARGA MODERADA</div>
        </div>
        <div class="kpi-card" style="${cardStyle('orange', filterOrangeActive, 'var(--status-orange)')}" onclick="TeamView.toggleWorkloadFilter('orange')">
          <div class="kpi-card-value" style="color:var(--status-orange);">${high}</div>
          <div class="kpi-card-label" style="font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-primary); font-size:0.75rem; margin-top:4px;">🟠 CARGA MEDIA</div>
        </div>
        <div class="kpi-card" style="${cardStyle('red', filterRedActive, 'var(--status-red)')}" onclick="TeamView.toggleWorkloadFilter('red')">
          <div class="kpi-card-value" style="color:var(--status-red);">${saturated}</div>
          <div class="kpi-card-label" style="font-weight:800; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-primary); font-size:0.75rem; margin-top:4px;">🔴 SATURADOS</div>
        </div>
      </div>

      <!-- Team Cards -->
      <div class="team-grid">
        ${teamCardsHTML}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  function getAvatarStyle(jerarquia, nombre, apellido) {
    let bg = null;
    let color = '#ffffff';
    const j = (jerarquia || '').toLowerCase().trim();

    if (j === 'prefecto principal' || j === 'pp') {
      bg = 'linear-gradient(135deg, #a855f7, #6b21a8)'; // Púrpura
    } else if (j === 'prefecto' || j === 'pr') {
      bg = 'linear-gradient(135deg, #3b82f6, #1d4ed8)'; // Azul
    } else if (j === 'subprefecto' || j === 'sp') {
      bg = 'linear-gradient(135deg, #38bdf8, #0284c7)'; // Celeste
    } else if (j === 'oficial principal' || j === 'op' || j === 'oficial auxiliar' || j === 'ox' || j === 'oficial ayudante' || j === 'oa') {
      bg = 'linear-gradient(135deg, #f8fafc, #cbd5e1)'; // Blanco
      color = '#0f172a';
    } else if (j === 'ayudante mayor' || j === 'am' || j === 'ayudante principal' || j === 'ap') {
      bg = 'linear-gradient(135deg, #22c55e, #15803d)'; // Verde
    } else if (j === 'ayudante de primera' || j === 'ai' || j === 'ayudante de segunda' || j === 'as' || j === 'ayudante de tercera' || j === 'at') {
      bg = 'linear-gradient(135deg, #facc15, #b45309)'; // Amarillo
    } else if (j === 'cabo primero' || j === 'ci' || j === 'cabo segundo' || j === 'cs' || j === 'marinero' || j === 'mo') {
      bg = 'linear-gradient(135deg, #f43f5e, #be123c)'; // Rojo
    } else {
      const hue = ((nombre || 'A').charCodeAt(0) * 37 + (apellido || 'A').charCodeAt(0) * 53) % 360;
      bg = `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 70%, 45%))`;
    }

    return `background:${bg}; color:${color};`;
  }

  function renderWorkloadCard(w) {
    const initials = (w.member.nombre[0] + w.member.apellido[0]).toUpperCase();
    const avatarStyle = getAvatarStyle(w.member.jerarquia, w.member.nombre, w.member.apellido);

    return `
      <div class="team-card animate-slide-up">
        <div class="team-card-header" style="cursor:pointer;" onclick="TeamView.openManageProjectsModal('${w.member.id}')" title="Gestionar proyectos del integrante">
          <div class="team-card-avatar" style="${avatarStyle}">${initials}</div>
          <div class="team-card-info">
            <h3 style="display:flex;align-items:center;gap:6px;">
              ${w.fullName}
              <i data-lucide="settings" class="team-card-settings-icon" title="Gestionar Proyectos"></i>
            </h3>
            <span>${w.member.rol}${w.member.destino ? ` — ${w.member.destino}` : ''}</span>
          </div>
          ${w.member.isExterno ? `
            <div class="team-card-status available" style="background:${w.member.activo !== false ? 'var(--primary-500)' : 'var(--status-gray)'};color:white;font-size:0.6rem;padding:2px 6px;">
              ${w.member.activo !== false ? 'EXTERNO' : 'EXTERNO (INACTIVO)'}
            </div>
          ` : `
            <div class="team-card-status ${w.loadClass}">
              ${w.loadLabel}
            </div>
          `}
        </div>

        ${w.member.isExterno ? `
          <div style="background:var(--bg-tertiary);padding:10px 12px;border-radius:8px;margin-bottom:12px;font-size:0.75rem;">
            ${w.member.email ? `<div style="margin-bottom:4px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <i data-lucide="mail" style="width:12px;height:12px;color:var(--text-tertiary);"></i> ${w.member.email}
            </div>` : ''}
            ${w.member.celular ? `<div style="margin-bottom:4px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <i data-lucide="smartphone" style="width:12px;height:12px;color:var(--text-tertiary);"></i> ${w.member.celular}
            </div>` : ''}
            ${w.member.telefonoTrabajo ? `<div style="color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
              <i data-lucide="phone" style="width:12px;height:12px;color:var(--text-tertiary);"></i> ${w.member.telefonoTrabajo}
            </div>` : ''}
            ${!w.member.email && !w.member.celular && !w.member.telefonoTrabajo ? '<div style="color:var(--text-tertiary);">Sin datos de contacto</div>' : ''}
          </div>
        ` : `
          <div class="team-card-load load-${w.loadLevel}">
            <div class="team-card-load-header">
              <span class="team-card-load-label">Carga de Trabajo</span>
              <span class="team-card-load-value" style="color:var(--status-${w.loadLevel === 'green' ? 'green' : w.loadLevel === 'yellow' ? 'yellow' : w.loadLevel === 'orange' ? 'orange' : 'red'});">
                ${w.count} / ${w.max} proyectos
              </span>
            </div>
            <div class="load-bar">
              <div class="load-bar-fill" style="width:${w.loadPercentage}%;"></div>
            </div>
          </div>
        `}

        ${w.assignedProjects.length > 0 ? `
          <div class="team-card-projects">
            <div class="team-card-projects-title">Proyectos Activos</div>
            ${w.assignedProjects.map(p => {
              const statusInfo = DataStore.getStatusInfo(p.estado);
              const prioInfo = DataStore.getPriorityInfo(p.prioridad);
              return `
                <div class="team-card-project-item" style="cursor:pointer;" onclick="ProjectsView.showDetail('${p.id}')">
                  <span class="truncate" style="max-width:180px;" title="${p.nombre}">${p.nombre}</span>
                  <div class="flex gap-2">
                    <span class="badge badge-status ${statusInfo.badgeClass}" style="font-size:0.6rem;">${statusInfo.label}</span>
                    <span class="badge ${prioInfo.badgeClass}" style="font-size:0.6rem;">${prioInfo.label}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div style="text-align:center;padding:16px 0;color:var(--text-tertiary);font-size:0.78rem;">
            Sin proyectos activos asignados
          </div>
        `}
      </div>
    `;
  }

  function renderExternals() {
    const teamContent = document.getElementById('team-content');
    const workload = DataStore.getTeamWorkload(true).filter(w => w.member.isExterno);

    if (workload.length === 0) {
      teamContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🤝</div>
          <h3>Sin contactos externos</h3>
          <p>Agregá contactos externos o stakeholders al sistema.</p>
          ${AuthManager.canManageTeam() ? `<button class="btn btn-primary" onclick="TeamView.openMemberForm()">
            <i data-lucide="user-plus" style="width:16px;height:16px;"></i> Agregar Contacto
          </button>` : ''}
        </div>
      `;
      return;
    }

    teamContent.innerHTML = `
      <div class="team-grid" style="margin-top:20px;">
        ${workload.map(w => renderWorkloadCard(w)).join('')}
      </div>
    `;
  }

  /* ── Member List (Table) ── */
  function renderMembers() {
    const team = DataStore.getTeam().filter(m => !m.isExterno);
    const teamContent = document.getElementById('team-content');

    if (team.length === 0) {
      teamContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>Sin miembros</h3>
          <p>Agregá al primer miembro del equipo.</p>
          ${AuthManager.canManageTeam() ? `<button class="btn btn-primary" onclick="TeamView.openMemberForm()">
            <i data-lucide="user-plus" style="width:16px;height:16px;"></i> Agregar Miembro
          </button>` : ''}
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    teamContent.innerHTML = `
      <div class="data-table-container">
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Miembro</th>
                <th>Rol</th>
                <th>Destino</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Máx. Proyectos</th>
                <th>Proyectos Activos</th>
                <th style="width:80px;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${team.map(m => {
                const workload = DataStore.getTeamWorkload().find(w => w.member.id === m.id);
                const count = workload ? workload.count : 0;
                const initials = (m.nombre[0] + m.apellido[0]).toUpperCase();
                const avatarStyle = getAvatarStyle(m.jerarquia, m.nombre, m.apellido);

                return `
                  <tr>
                    <td>
                      <div class="flex items-center gap-3">
                        <div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0;${avatarStyle}">
                          ${initials}
                        </div>
                        <div>
                          <div style="font-weight:600;color:var(--text-primary);font-size:0.85rem;display:flex;align-items:center;gap:6px;">
                            ${m.jerarquia ? `<span style="font-size:0.68rem;color:var(--primary-300);background:rgba(99,102,241,0.15);padding:2px 6px;border-radius:4px;font-weight:600;">${m.jerarquia}</span>` : ''}
                            <span>${m.nombre} ${m.apellido}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      ${m.isExterno ? `
                        <span class="badge" style="background:var(--primary-500);color:white;margin-bottom:4px;display:inline-block;">EXTERNO</span><br>
                        <span style="font-size:0.7rem;color:var(--text-tertiary);">${m.rol}</span>
                      ` : `
                        <span class="badge" style="background:rgba(99,102,241,0.1);color:var(--primary-400);">${m.rol}</span>
                      `}
                    </td>
                    <td><span style="font-weight:600;font-family:monospace;color:var(--text-secondary);font-size:0.78rem;">${m.destino || '—'}</span></td>
                    <td>
                      <div style="font-size:0.75rem;color:var(--text-secondary);line-height:1.4;">
                        ${m.email ? `<div><i data-lucide="mail" style="width:10px;height:10px;margin-right:4px;"></i>${m.email}</div>` : ''}
                        ${m.celular ? `<div><i data-lucide="smartphone" style="width:10px;height:10px;margin-right:4px;"></i>${m.celular}</div>` : ''}
                        ${m.telefonoTrabajo ? `<div><i data-lucide="phone" style="width:10px;height:10px;margin-right:4px;"></i>${m.telefonoTrabajo}</div>` : ''}
                        ${!m.email && !m.celular && !m.telefonoTrabajo ? '—' : ''}
                      </div>
                    </td>
                    <td>
                      <span class="badge ${m.activo ? 'badge-produccion' : 'badge-cancelado'}">
                        ${m.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style="text-align:center;font-weight:600;">${m.isExterno ? '—' : m.maxProyectos}</td>
                    <td style="text-align:center;font-weight:600;">${count}</td>
                    <td>
                      <div class="flex gap-2">
                        <button class="btn btn-ghost btn-icon sm" title="Gestionar Proyectos" onclick="TeamView.openManageProjectsModal('${m.id}')" style="color:var(--primary-400);">
                          <i data-lucide="folder-kanban" style="width:14px;height:14px;"></i>
                        </button>
                        ${AuthManager.canManageTeam() ? `
                        <button class="btn btn-ghost btn-icon sm" title="Editar" onclick="TeamView.openMemberForm('${m.id}')">
                          <i data-lucide="pencil" style="width:14px;height:14px;"></i>
                        </button>
                        <button class="btn btn-ghost btn-icon sm" title="Eliminar" onclick="TeamView.openDeleteMember('${m.id}')" style="color:var(--status-red);">
                          <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                        </button>` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  /* ── Member Form ── */
  let editingMemberId = null;

  function openMemberForm(memberId = null) {
    editingMemberId = memberId;
    const member = memberId ? DataStore.getTeamMemberById(memberId) : null;
    document.getElementById('member-modal-title').textContent = member ? 'Editar Miembro' : 'Nuevo Miembro';

    document.getElementById('member-modal-body').innerHTML = `
      <form id="member-form" onsubmit="return false;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Nombre <span class="required">*</span></label>
            <input type="text" class="form-input" id="member-nombre" value="${member?.nombre || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Apellido <span class="required">*</span></label>
            <input type="text" class="form-input" id="member-apellido" value="${member?.apellido || ''}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jerarquía</label>
            <input type="text" class="form-input" id="member-jerarquia" value="${member?.jerarquia || ''}" placeholder="Ej: Prefecto, Cabo Primero">
          </div>
          <div class="form-group">
            <label class="form-label">Destino</label>
            <input type="text" class="form-input" id="member-destino" value="${member?.destino || ''}" placeholder="Ej: DPSN, DICO, DTRA" style="text-transform: uppercase;">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Rol</label>
          <select class="form-select" id="member-rol">
            ${DataStore.ROLES.map(r => `<option value="${r}" ${member?.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="member-email" value="${member?.email || ''}" placeholder="usuario@organismo.gob">
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding-bottom:10px;">
              <input type="checkbox" id="member-isExterno" ${member?.isExterno ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary-500);">
              <span style="font-size:0.8rem;color:var(--text-primary);font-weight:600;">Personal Externo / Contacto</span>
            </label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Celular</label>
            <input type="text" class="form-input" id="member-celular" value="${member?.celular || ''}" placeholder="Ej: +54 9 11 1234-5678">
          </div>
          <div class="form-group">
            <label class="form-label">Teléfono (Interno)</label>
            <input type="text" class="form-input" id="member-telefonoTrabajo" value="${member?.telefonoTrabajo || ''}" placeholder="Ej: Int. 4321">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Máx. Proyectos Simultáneos</label>
            <input type="number" class="form-input" id="member-maxProyectos" value="${member?.maxProyectos || 5}" min="1" max="15">
          </div>
          <div class="form-group">
            <label class="form-label">Estado</label>
            <select class="form-select" id="member-activo">
              <option value="true" ${member?.activo !== false ? 'selected' : ''}>Activo</option>
              <option value="false" ${member?.activo === false ? 'selected' : ''}>Inactivo</option>
            </select>
          </div>
        </div>
      </form>
    `;

    document.getElementById('member-modal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  function closeMemberForm() {
    document.getElementById('member-modal').classList.remove('active');
    editingMemberId = null;
  }

  function saveMember() {
    const nombre = document.getElementById('member-nombre').value.trim();
    const apellido = document.getElementById('member-apellido').value.trim();
    if (!nombre || !apellido) {
      App.showToast('Nombre y apellido son requeridos', 'error');
      return;
    }

    const data = {
      nombre,
      apellido,
      rol: document.getElementById('member-rol').value,
      jerarquia: document.getElementById('member-jerarquia').value.trim(),
      destino: document.getElementById('member-destino').value.trim().toUpperCase(),
      email: document.getElementById('member-email').value.trim(),
      celular: document.getElementById('member-celular').value.trim(),
      telefonoTrabajo: document.getElementById('member-telefonoTrabajo').value.trim(),
      isExterno: document.getElementById('member-isExterno').checked,
      maxProyectos: parseInt(document.getElementById('member-maxProyectos').value) || 5,
      activo: document.getElementById('member-activo').value === 'true'
    };

    if (editingMemberId) {
      DataStore.updateTeamMember(editingMemberId, data);
      App.showToast('Miembro actualizado', 'success');
    } else {
      DataStore.createTeamMember(data);
      App.showToast('Miembro agregado al equipo', 'success');
    }

    closeMemberForm();
    render();
  }

  /* ── Delete Member ── */
  let deletingMemberId = null;

  function openDeleteMember(memberId) {
    deletingMemberId = memberId;
    const member = DataStore.getTeamMemberById(memberId);
    document.getElementById('delete-member-name').innerHTML =
      `Se eliminará a <strong>"${member.nombre} ${member.apellido}"</strong> del equipo.`;
    document.getElementById('delete-member-modal').classList.add('active');
    if (window.lucide) lucide.createIcons();
  }

  function closeDeleteMember() {
    document.getElementById('delete-member-modal').classList.remove('active');
    deletingMemberId = null;
  }

  function confirmDeleteMember() {
    if (deletingMemberId) {
      DataStore.deleteTeamMember(deletingMemberId);
      App.showToast('Miembro eliminado del equipo', 'success');
      closeDeleteMember();
      render();
    }
  }

  /* ── Manage Member Projects ── */
  function openManageProjectsModal(memberId) {
    const modal = document.getElementById('manage-projects-modal');
    if (!modal) return;

    modal.classList.add('active');
    renderManageProjectsContent(memberId);
  }

  function closeManageProjectsModal() {
    const modal = document.getElementById('manage-projects-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    render(); // Refresh main view to show updated workloads
  }

  function getRoleName(roleKey) {
    const names = {
      pm: 'Project Manager',
      liderTecnico: 'Líder Técnico',
      scrumMaster: 'Scrum Master',
      productOwner: 'Product Owner',
      desarrollador: 'Desarrollador',
      analistaFuncional: 'Analista Funcional',
      qaTester: 'QA / Tester',
      dba: 'DBA',
      uxuiDesigner: 'UX/UI Designer'
    };
    return names[roleKey] || roleKey;
  }

  function renderManageProjectsContent(memberId) {
    const member = DataStore.getTeamMemberById(memberId);
    if (!member) return;

    const modalBody = document.getElementById('manage-projects-body');
    if (!modalBody) return;

    const titleElem = document.getElementById('manage-projects-title');
    if (titleElem) {
      titleElem.textContent = `Gestionar Proyectos: ${member.nombre} ${member.apellido}`;
    }

    const projects = DataStore.getProjects();
    const activeStatuses = ['solicitud', 'backlog', 'analisis', 'desarrollo', 'testing', 'pausado'];
    
    // Find all projects where this member is assigned in any role
    const assigned = [];
    projects.forEach(p => {
      if (!activeStatuses.includes(p.estado)) return; // Only active projects
      
      if (p.pm === memberId) assigned.push({ project: p, roleKey: 'pm', roleName: 'Project Manager' });
      if (p.liderTecnico === memberId) assigned.push({ project: p, roleKey: 'liderTecnico', roleName: 'Líder Técnico' });
      if (p.scrumMaster === memberId) assigned.push({ project: p, roleKey: 'scrumMaster', roleName: 'Scrum Master' });
      if (p.productOwner === memberId) assigned.push({ project: p, roleKey: 'productOwner', roleName: 'Product Owner' });
      if (p.desarrolladores && p.desarrolladores.includes(memberId)) {
        assigned.push({ project: p, roleKey: 'desarrollador', roleName: member.rol || 'Desarrollador' });
      }
    });

    const otherActiveMembers = DataStore.getTeam().filter(m => m.activo && m.id !== memberId);
    const activeProjects = projects.filter(p => !['produccion', 'cancelado'].includes(p.estado));
    currentActiveProjectsForModal = activeProjects;

    let assignedHTML = '';
    if (assigned.length === 0) {
      assignedHTML = `
        <div style="text-align:center;padding:24px;color:var(--text-tertiary);font-size:0.85rem;">
          No tiene proyectos activos asignados en este momento.
        </div>
      `;
    } else {
      assignedHTML = `
        <div class="data-table-wrapper" style="margin-bottom:20px; max-height:280px; overflow-y:auto; border: 1px solid var(--border-subtle); border-radius: var(--border-radius-md);">
          <table class="data-table" style="font-size:0.8rem;">
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Etapa</th>
                <th>Rol</th>
                <th>Reasignar / Distribuir a</th>
                <th style="width:70px;text-align:center;">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${assigned.map(item => {
                const p = item.project;
                const rKey = item.roleKey;
                const rName = item.roleName;
                const statusInfo = DataStore.getStatusInfo(p.estado);

                return `
                  <tr>
                    <td>
                      <div style="font-weight:600;color:var(--text-primary);">${p.nombre}</div>
                      <div style="font-size:0.7rem;color:var(--text-tertiary);">${p.areaSolicitante || '—'}</div>
                    </td>
                    <td>
                      <span class="badge badge-status ${statusInfo.badgeClass}" style="font-size:0.72rem;padding:2px 8px;">${statusInfo.label}</span>
                    </td>
                    <td>
                      <span class="badge" style="background:rgba(99,102,241,0.1);color:var(--primary-400);">${rName}</span>
                    </td>
                    <td>
                      <div class="flex gap-2 items-center">
                        <select class="form-select sm" id="reassign-select-${p.id}-${rKey}" style="padding:4px 8px;font-size:0.75rem;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-sm);color:var(--text-primary);height:30px;width:150px;">
                          <option value="">— Seleccionar —</option>
                          ${otherActiveMembers.map(m => `<option value="${m.id}">${m.nombre} ${m.apellido} (${m.rol})</option>`).join('')}
                        </select>
                        <button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:0.75rem;height:30px;display:flex;align-items:center;gap:4px;" onclick="TeamView.reassignProject('${memberId}', '${p.id}', '${rKey}', document.getElementById('reassign-select-${p.id}-${rKey}').value)" title="Transferir este rol a otro integrante">
                          <i data-lucide="move" style="width:12px;height:12px;"></i> Reasignar
                        </button>
                      </div>
                    </td>
                    <td style="text-align:center;">
                      <button class="btn btn-ghost btn-icon sm" style="color:var(--status-red);padding:4px;display:inline-flex;" onclick="TeamView.unassignProject('${memberId}', '${p.id}', '${rKey}')" title="Quitar del proyecto">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    modalBody.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:20px;">
        <!-- Header info -->
        <div style="background:rgba(99,102,241,0.05);padding:12px 16px;border-radius:var(--border-radius-md);border-left:3px solid var(--primary-500);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:600;display:block;">Integrante</span>
            <strong style="font-size:0.95rem;color:var(--text-primary);">${member.nombre} ${member.apellido}</strong>
            <span style="font-size:0.78rem;color:var(--text-secondary);"> — ${member.rol}</span>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.7rem;color:var(--text-tertiary);text-transform:uppercase;font-weight:600;display:block;">Proyectos Activos</span>
            <strong style="font-size:1.1rem;color:var(--primary-400);">${new Set(assigned.map(a => a.project.id)).size}</strong>
          </div>
        </div>

        <!-- Section 1: Assigned projects -->
        <div>
          <h4 style="font-size:0.8rem;font-weight:600;color:var(--primary-400);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">Proyectos Asignados Actualmente</h4>
          ${assignedHTML}
        </div>

        <hr style="border:none;border-top:1px solid var(--border-subtle);margin:5px 0;">

        <!-- Section 2: Assign new project -->
        <div>
          <h4 style="font-size:0.8rem;font-weight:600;color:var(--primary-400);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em;">Asignar Nuevo Proyecto</h4>
          
          <div style="margin-bottom:10px;">
            <input type="text" class="form-input" id="search-assign-project" placeholder="Buscar proyecto para asignar (por nombre o área)..." style="font-size:0.75rem; height:32px; padding:4px 8px; border: 1px solid var(--border-subtle); border-radius: var(--border-radius-sm); background: var(--bg-input); color: var(--text-primary); width:100%;" onkeyup="TeamView.filterAssignProjects(this.value)">
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:12px;align-items:end;">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.75rem;margin-bottom:4px;">Seleccione Proyecto</label>
              <select class="form-select" id="assign-project-id" style="height:38px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-sm);color:var(--text-primary);width:100%;">
                <option value="">— Seleccionar Proyecto —</option>
                ${activeProjects.map(p => `<option value="${p.id}">${p.nombre} (${p.areaSolicitante || 'Sin área'})</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.75rem;margin-bottom:4px;">Rol en el Proyecto</label>
              <select class="form-select" id="assign-project-role" style="height:38px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:var(--border-radius-sm);color:var(--text-primary);width:100%;">
                <option value="desarrollador">Desarrollador</option>
                <option value="pm">Project Manager</option>
                <option value="liderTecnico">Líder Técnico</option>
                <option value="scrumMaster">Scrum Master</option>
                <option value="productOwner">Product Owner</option>
                <option value="analistaFuncional">Analista Funcional</option>
                <option value="qaTester">QA / Tester</option>
                <option value="dba">DBA</option>
                <option value="uxuiDesigner">UX/UI Designer</option>
              </select>
            </div>
            <button class="btn btn-primary" style="height:38px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 16px;" onclick="TeamView.assignProject('${memberId}', document.getElementById('assign-project-id').value, document.getElementById('assign-project-role').value)">
              <i data-lucide="plus-circle" style="width:16px;height:16px;"></i> Asignar
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  let currentActiveProjectsForModal = [];
  
  function filterAssignProjects(query) {
    const term = query.toLowerCase();
    const select = document.getElementById('assign-project-id');
    if (!select) return;
    
    // Filtramos los proyectos originales guardados en memoria
    const filtered = currentActiveProjectsForModal.filter(p => 
      (p.nombre + ' ' + (p.areaSolicitante || '')).toLowerCase().includes(term)
    );
    
    const currentVal = select.value;
    let html = '<option value="">— Seleccionar Proyecto —</option>';
    html += filtered.map(p => `<option value="${p.id}">${p.nombre} (${p.areaSolicitante || 'Sin área'})</option>`).join('');
    
    select.innerHTML = html;
    
    // Restaurar valor si sigue estando en la lista
    if (filtered.some(p => p.id === currentVal)) {
      select.value = currentVal;
    }
  }

  function assignProject(memberId, projectId, roleKey) {
    if (!projectId) {
      App.showToast('Selecciona un proyecto para asignar', 'error');
      return;
    }
    if (!roleKey) {
      App.showToast('Selecciona un rol para la asignación', 'error');
      return;
    }

    const project = DataStore.getProjectById(projectId);
    if (!project) return;

    const leadershipKeys = ['pm', 'liderTecnico', 'scrumMaster', 'productOwner'];
    if (!leadershipKeys.includes(roleKey)) {
      const devs = project.desarrolladores || [];
      if (devs.includes(memberId)) {
        App.showToast('El integrante ya está asignado a este proyecto', 'warning');
        return;
      }
      const updatedDevs = [...devs, memberId];
      DataStore.updateProject(projectId, { desarrolladores: updatedDevs });
    } else {
      if (project[roleKey] === memberId) {
        App.showToast('El integrante ya tiene asignado este rol en el proyecto', 'warning');
        return;
      }
      const previousAssigneeId = project[roleKey];
      DataStore.updateProject(projectId, { [roleKey]: memberId });

      if (previousAssigneeId) {
        const prevMember = DataStore.getTeamMemberById(previousAssigneeId);
        const prevName = prevMember ? `${prevMember.nombre} ${prevMember.apellido}` : 'otro integrante';
        App.showToast(`Se reemplazó a ${prevName} como ${getRoleName(roleKey)} en "${project.nombre}"`, 'info');
      }
    }

    App.showToast(`Integrante asignado a "${project.nombre}" como ${getRoleName(roleKey)}`, 'success');
    
    // Refresh modal content
    renderManageProjectsContent(memberId);
    App.updateSidebarCounts();
  }

  function unassignProject(memberId, projectId, roleKey) {
    const project = DataStore.getProjectById(projectId);
    if (!project) return;

    const leadershipKeys = ['pm', 'liderTecnico', 'scrumMaster', 'productOwner'];
    if (!leadershipKeys.includes(roleKey)) {
      const devs = (project.desarrolladores || []).filter(id => id !== memberId);
      DataStore.updateProject(projectId, { desarrolladores: devs });
    } else {
      DataStore.updateProject(projectId, { [roleKey]: '' });
    }

    App.showToast(`Se quitó al integrante de "${project.nombre}" como ${getRoleName(roleKey)}`, 'success');
    
    // Refresh modal content
    renderManageProjectsContent(memberId);
    App.updateSidebarCounts();
  }

  function reassignProject(memberId, projectId, roleKey, targetMemberId) {
    if (!targetMemberId) {
      App.showToast('Por favor, selecciona un integrante para reasignar', 'error');
      return;
    }

    const project = DataStore.getProjectById(projectId);
    if (!project) return;

    const targetMember = DataStore.getTeamMemberById(targetMemberId);
    const targetName = targetMember ? `${targetMember.nombre} ${targetMember.apellido}` : 'otro integrante';

    const leadershipKeys = ['pm', 'liderTecnico', 'scrumMaster', 'productOwner'];
    if (!leadershipKeys.includes(roleKey)) {
      // Remove current from desarrolladores
      const devs = (project.desarrolladores || []).filter(id => id !== memberId);
      // Add target if not exists
      const targetProject = DataStore.getProjectById(projectId);
      const targetDevs = [...(targetProject.desarrolladores || [])];
      const filteredTargetDevs = targetDevs.filter(id => id !== memberId);
      if (!filteredTargetDevs.includes(targetMemberId)) {
        filteredTargetDevs.push(targetMemberId);
      }
      DataStore.updateProject(projectId, { desarrolladores: filteredTargetDevs });
    } else {
      // For leadership roles, set target member
      DataStore.updateProject(projectId, { [roleKey]: targetMemberId });
    }

    App.showToast(`Proyecto "${project.nombre}" reasignado a ${targetName}`, 'success');
    
    // Refresh modal content
    renderManageProjectsContent(memberId);
    App.updateSidebarCounts();
  }

  function toggleWorkloadFilter(level) {
    workloadFilter = workloadFilter === level ? 'all' : level;
    renderWorkload();
  }

  return {
    render,
    switchTab,
    openMemberForm,
    closeMemberForm,
    saveMember,
    openDeleteMember,
    closeDeleteMember,
    confirmDeleteMember,
    openManageProjectsModal,
    closeManageProjectsModal,
    assignProject,
    unassignProject,
    reassignProject,
    filterAssignProjects,
    toggleWorkloadFilter
  };
})();
