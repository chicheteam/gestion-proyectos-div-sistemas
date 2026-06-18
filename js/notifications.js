/* ============================================
   NOTIFICATIONS ENGINE
   Smart alerts & configurable notification center
   ============================================ */

const NotificationsEngine = (() => {
  const SETTINGS_KEY = 'div_sistemas_notif_settings';
  let currentView = 'alerts'; // 'alerts' | 'settings'

  /* ── Default Settings ── */
  function getDefaultSettings() {
    return {
      deadlinesEnabled: true,
      deadlineDays: 15,
      saturatedTeamEnabled: true,
      missingDatesEnabled: true,
      inconsistenciesEnabled: true
    };
  }

  function getSettings() {
    return DataStore.getSettings();
  }

  function saveSettings(settings) {
    DataStore.saveSettings(settings);
  }

  /* ── Alert Generation ── */
  function generateAlerts() {
    const settings = getSettings();
    const alerts = [];

    const projects = DataStore.getProjects();
    const now = new Date();

    // 1. Próximas Entregas
    if (settings.deadlinesEnabled) {
      const limitMs = settings.deadlineDays * 24 * 60 * 60 * 1000;
      projects.forEach(p => {
        if (['produccion', 'cancelado'].includes(p.estado)) return;
        const dateStr = p.fechaEstimadaFin;
        if (!dateStr) return;
        const deadline = new Date(dateStr + 'T12:00:00');
        const diff = deadline - now;
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
          alerts.push({
            type: 'error',
            icon: '⚠️',
            title: `Entrega vencida: ${p.nombre}`,
            desc: `Venció hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? 's' : ''}. Fecha estimada: ${formatDate(dateStr)}`,
            projectId: p.id,
            priority: 0
          });
        } else if (daysLeft <= settings.deadlineDays) {
          alerts.push({
            type: 'warning',
            icon: '📅',
            title: `Entrega próxima: ${p.nombre}`,
            desc: `Faltan ${daysLeft} día${daysLeft !== 1 ? 's' : ''} para la entrega. Fecha: ${formatDate(dateStr)}`,
            projectId: p.id,
            priority: 1
          });
        }
      });
    }

    // 2. Miembros saturados
    if (settings.saturatedTeamEnabled) {
      const workloads = DataStore.getTeamWorkload();
      workloads.forEach(w => {
        if (w.count >= w.max) {
          alerts.push({
            type: 'error',
            icon: '🔥',
            title: `Equipo saturado: ${w.fullName}`,
            desc: `Tiene ${w.count} proyecto${w.count !== 1 ? 's' : ''} asignados (máx: ${w.max}). Carga al ${w.loadPercentage}%.`,
            priority: 2
          });
        } else if (w.count >= w.max - 1 && w.count > 0) {
          alerts.push({
            type: 'warning',
            icon: '⚡',
            title: `Carga alta: ${w.fullName}`,
            desc: `Tiene ${w.count}/${w.max} proyectos asignados. Próximo a saturarse.`,
            priority: 3
          });
        }
      });
    }

    // 3. Proyectos sin fecha de solicitud o sin fecha de inicio
    if (settings.missingDatesEnabled) {
      projects.forEach(p => {
        if (['produccion', 'cancelado'].includes(p.estado)) return;

        if (!p.fechaSolicitud) {
          alerts.push({
            type: 'info',
            icon: '📋',
            title: `Sin fecha de solicitud: ${p.nombre}`,
            desc: `Este proyecto no tiene registrada una fecha de solicitud.`,
            projectId: p.id,
            priority: 5
          });
        }

        const activeStates = ['analisis', 'desarrollo', 'testing', 'pausado'];
        if (activeStates.includes(p.estado) && !p.fechaRealInicio && !p.fechaEstimadaInicio) {
          alerts.push({
            type: 'warning',
            icon: '📌',
            title: `Sin fecha de inicio: ${p.nombre}`,
            desc: `Estado "${DataStore.getStatusInfo(p.estado).label}" pero sin fecha de inicio registrada.`,
            projectId: p.id,
            priority: 4
          });
        }
      });
    }

    // 4. Inconsistencias en la carga de datos
    if (settings.inconsistenciesEnabled) {
      projects.forEach(p => {
        // Proyecto en produccion sin fecha real de fin
        if (p.estado === 'produccion' && !p.fechaRealFin) {
          alerts.push({
            type: 'warning',
            icon: '🔍',
            title: `Inconsistencia: ${p.nombre}`,
            desc: `Estado "En Producción" pero sin fecha real de finalización.`,
            projectId: p.id,
            priority: 4
          });
        }

        // Avance 100% pero no está en produccion
        if (p.porcentajeAvance >= 100 && p.estado !== 'produccion' && p.estado !== 'cancelado') {
          alerts.push({
            type: 'info',
            icon: '🔄',
            title: `Revisar estado: ${p.nombre}`,
            desc: `Avance al ${p.porcentajeAvance}% pero estado "${DataStore.getStatusInfo(p.estado).label}". ¿Debería pasar a Producción?`,
            projectId: p.id,
            priority: 4
          });
        }

        // Fecha fin anterior a fecha inicio
        const startDate = p.fechaRealInicio || p.fechaEstimadaInicio;
        const endDate = p.fechaRealFin || p.fechaEstimadaFin;
        if (startDate && endDate && endDate < startDate) {
          alerts.push({
            type: 'error',
            icon: '❌',
            title: `Fechas inválidas: ${p.nombre}`,
            desc: `La fecha de fin (${formatDate(endDate)}) es anterior a la de inicio (${formatDate(startDate)}).`,
            projectId: p.id,
            priority: 0
          });
        }

        // Proyecto activo sin equipo asignado
        const activeDevStates = ['desarrollo', 'testing'];
        if (activeDevStates.includes(p.estado)) {
          const hasTeam = p.pm || p.liderTecnico || p.scrumMaster || p.productOwner || p.analistaFuncional || p.qaTester || p.dba || p.uxuiDesigner || (p.desarrolladores && p.desarrolladores.length > 0);
          if (!hasTeam) {
            alerts.push({
              type: 'warning',
              icon: '👤',
              title: `Sin equipo: ${p.nombre}`,
              desc: `En estado "${DataStore.getStatusInfo(p.estado).label}" pero no tiene ningún miembro asignado.`,
              projectId: p.id,
              priority: 3
            });
          }
        }
      });
    }

    // Sort: errors first, then warnings, then info
    alerts.sort((a, b) => a.priority - b.priority);
    return alerts;
  }

  /* ── Rendering ── */
  function renderDropdown() {
    const dropdown = document.getElementById('notifications-dropdown');
    if (!dropdown) return;

    if (currentView === 'settings') {
      renderSettingsView(dropdown);
    } else {
      renderAlertsView(dropdown);
    }

    if (window.lucide) lucide.createIcons();
  }

  function renderAlertsView(dropdown) {
    const alerts = generateAlerts();

    const alertsHTML = alerts.length === 0
      ? `<div class="notifications-empty">🎉 ¡Todo en orden! No hay alertas pendientes.</div>`
      : alerts.map(a => `
        <div class="notification-item" ${a.projectId ? `onclick="NotificationsEngine.navigateToProject('${a.projectId}')"` : ''}>
          <div class="notification-icon-container ${a.type}">
            ${a.icon}
          </div>
          <div class="notification-content">
            <div class="notification-title">${a.title}</div>
            <div class="notification-desc">${a.desc}</div>
          </div>
        </div>
      `).join('');

    dropdown.innerHTML = `
      <div class="notifications-header">
        <div class="notifications-header-title">
          🔔 Alertas
          ${alerts.length > 0 ? `<span style="background: rgba(239,68,68,0.15); color: var(--status-red); font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 10px;">${alerts.length}</span>` : ''}
        </div>
        <button class="notifications-settings-btn" onclick="NotificationsEngine.showSettings()" title="Configuración de notificaciones">
          <i data-lucide="settings" style="width: 16px; height: 16px;"></i>
        </button>
      </div>
      <div class="notifications-list">
        ${alertsHTML}
      </div>
    `;
  }

  function renderSettingsView(dropdown) {
    const settings = getSettings();

    dropdown.innerHTML = `
      <div class="notifications-header">
        <div class="notifications-header-title">
          <button class="notifications-settings-btn" onclick="NotificationsEngine.showAlerts()" title="Volver a Alertas" style="margin-right: 4px;">
            <i data-lucide="arrow-left" style="width: 16px; height: 16px;"></i>
          </button>
          ⚙️ Configuración
        </div>
      </div>
      <div class="notifications-settings-view" style="max-height: 400px; overflow-y: auto;">
        <!-- Deadlines -->
        <div class="notifications-settings-item">
          <div class="notifications-settings-row">
            <div>
              <div class="notifications-settings-label">📅 Entregas Próximas</div>
              <div class="notifications-settings-desc">Alertar cuando un proyecto se acerque a su fecha de entrega</div>
            </div>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="notif-deadlines" ${settings.deadlinesEnabled ? 'checked' : ''} onchange="NotificationsEngine.updateSetting('deadlinesEnabled', this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
          <div style="margin-top: 6px; display: ${settings.deadlinesEnabled ? 'flex' : 'none'}; align-items: center; gap: 8px;" id="deadline-days-container">
            <span class="notifications-settings-desc">Anticipación:</span>
            <select id="notif-deadline-days" style="background: rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('deadlineDays', parseInt(this.value))">
              <option value="7" ${settings.deadlineDays === 7 ? 'selected' : ''}>7 días</option>
              <option value="15" ${settings.deadlineDays === 15 ? 'selected' : ''}>15 días</option>
              <option value="30" ${settings.deadlineDays === 30 ? 'selected' : ''}>30 días</option>
              <option value="60" ${settings.deadlineDays === 60 ? 'selected' : ''}>60 días</option>
            </select>
          </div>
        </div>

        <!-- Saturated Team -->
        <div class="notifications-settings-item">
          <div class="notifications-settings-row">
            <div>
              <div class="notifications-settings-label">🔥 Equipo Saturado</div>
              <div class="notifications-settings-desc">Alertar cuando un miembro tenga demasiados proyectos</div>
            </div>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="notif-saturated" ${settings.saturatedTeamEnabled ? 'checked' : ''} onchange="NotificationsEngine.updateSetting('saturatedTeamEnabled', this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Missing Dates -->
        <div class="notifications-settings-item">
          <div class="notifications-settings-row">
            <div>
              <div class="notifications-settings-label">📌 Fechas Faltantes</div>
              <div class="notifications-settings-desc">Alertar por proyectos sin fecha de solicitud o de inicio</div>
            </div>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="notif-missing-dates" ${settings.missingDatesEnabled ? 'checked' : ''} onchange="NotificationsEngine.updateSetting('missingDatesEnabled', this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Inconsistencies -->
        <div class="notifications-settings-item">
          <div class="notifications-settings-row">
            <div>
              <div class="notifications-settings-label">🔍 Inconsistencias</div>
              <div class="notifications-settings-desc">Alertar por datos inconsistentes (estado vs avance, fechas inválidas, sin equipo)</div>
            </div>
            <div class="switch-container">
              <label class="switch">
                <input type="checkbox" id="notif-inconsistencies" ${settings.inconsistenciesEnabled ? 'checked' : ''} onchange="NotificationsEngine.updateSetting('inconsistenciesEnabled', this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Semaphore Thresholds -->
        <div style="margin-top: 10px; border-top: 1px solid var(--border-subtle); padding-top: 12px; display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 0.72rem; font-weight: 700; color: var(--primary-400); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">🚦 Umbrales de Semáforos</div>
          
          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Carga de Equipo (Promedio)</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size:0.65rem; color: var(--status-red); min-width: 45px;">Rojo ></span>
              <input type="number" value="${settings.thresholdTeamLoadRed ?? 85}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdTeamLoadRed', parseInt(this.value))">%
              <span style="font-size:0.65rem; color: var(--status-yellow); min-width: 55px; margin-left: 8px;">Amarillo ></span>
              <input type="number" value="${settings.thresholdTeamLoadYellow ?? 60}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdTeamLoadYellow', parseInt(this.value))">%
            </div>
          </div>

          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Entregas a Tiempo</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size:0.65rem; color: var(--status-red); min-width: 45px;">Rojo <</span>
              <input type="number" value="${settings.thresholdOnTimeRed ?? 50}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdOnTimeRed', parseInt(this.value))">%
              <span style="font-size:0.65rem; color: var(--status-yellow); min-width: 55px; margin-left: 8px;">Amarillo <</span>
              <input type="number" value="${settings.thresholdOnTimeYellow ?? 80}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdOnTimeYellow', parseInt(this.value))">%
            </div>
          </div>

          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Proyectos Bloqueados</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size:0.65rem; color: var(--status-red); min-width: 45px;">Rojo &ge;</span>
              <input type="number" value="${settings.thresholdBlockedRed ?? 3}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdBlockedRed', parseInt(this.value))">
              <span style="font-size:0.65rem; color: var(--status-yellow); min-width: 55px; margin-left: 8px;">Amarillo &ge;</span>
              <input type="number" value="${settings.thresholdBlockedYellow ?? 1}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdBlockedYellow', parseInt(this.value))">
            </div>
          </div>

          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Solicitudes Pendientes</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size:0.65rem; color: var(--status-red); min-width: 45px;">Rojo &ge;</span>
              <input type="number" value="${settings.thresholdPendingRed ?? 6}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdPendingRed', parseInt(this.value))">
              <span style="font-size:0.65rem; color: var(--status-yellow); min-width: 55px; margin-left: 8px;">Amarillo &ge;</span>
              <input type="number" value="${settings.thresholdPendingYellow ?? 3}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdPendingYellow', parseInt(this.value))">
            </div>
          </div>

          <div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">Sin Equipo Asignado</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size:0.65rem; color: var(--status-red); min-width: 45px;">Rojo &ge;</span>
              <input type="number" value="${settings.thresholdNoTeamRed ?? 2}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdNoTeamRed', parseInt(this.value))">
              <span style="font-size:0.65rem; color: var(--status-yellow); min-width: 55px; margin-left: 8px;">Amarillo &ge;</span>
              <input type="number" value="${settings.thresholdNoTeamYellow ?? 1}" style="width: 55px; background: rgba(255,255,255,0.05); color: var(--text-primary); border: 1px solid var(--border-subtle); padding: 3px 6px; border-radius: 4px; font-size: 0.72rem; font-family: 'Inter', sans-serif;" onchange="NotificationsEngine.updateSetting('thresholdNoTeamYellow', parseInt(this.value))">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Badge Dot ── */
  function updateBadge() {
    const dot = document.getElementById('notifications-badge-dot');
    if (!dot) return;
    const alerts = generateAlerts();
    dot.style.display = alerts.length > 0 ? 'block' : 'none';
  }

  /* ── Toggle Dropdown ── */
  function toggle() {
    const dropdown = document.getElementById('notifications-dropdown');
    if (!dropdown) return;
    const isOpen = dropdown.classList.contains('active');
    if (isOpen) {
      dropdown.classList.remove('active');
    } else {
      currentView = 'alerts';
      renderDropdown();
      dropdown.classList.add('active');
    }
  }

  function close() {
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) dropdown.classList.remove('active');
  }

  /* ── View Switching ── */
  function showSettings() {
    currentView = 'settings';
    renderDropdown();
  }

  function showAlerts() {
    currentView = 'alerts';
    renderDropdown();
  }

  /* ── Setting Updates ── */
  function updateSetting(key, value) {
    const settings = getSettings();
    settings[key] = value;
    saveSettings(settings);

    // Toggle deadline days container visibility
    if (key === 'deadlinesEnabled') {
      const container = document.getElementById('deadline-days-container');
      if (container) container.style.display = value ? 'flex' : 'none';
    }

    // Refresh dashboard if currently open
    if (document.getElementById('upcoming-deadlines-list') && typeof DashboardView !== 'undefined') {
      DashboardView.render();
    }

    // Update badge
    updateBadge();
  }

  /* ── Navigation ── */
  function navigateToProject(projectId) {
    close();
    App.navigateTo('projects');
    setTimeout(() => {
      if (typeof ProjectsView !== 'undefined' && ProjectsView.openForm) {
        ProjectsView.openForm(projectId);
      }
    }, 150);
  }

  /* ── Init ── */
  function init() {
    // Bell button click
    const btn = document.getElementById('btn-notifications');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('notifications-dropdown');
      const btn = document.getElementById('btn-notifications');
      if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
          close();
        }
      }
    });

    // Prevent dropdown clicks from bubbling
    const dropdown = document.getElementById('notifications-dropdown');
    if (dropdown) {
      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Initial badge update
    updateBadge();
  }

  /* ── Helpers ── */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return {
    init,
    toggle,
    close,
    showSettings,
    showAlerts,
    updateSetting,
    updateBadge,
    navigateToProject
  };
})();
