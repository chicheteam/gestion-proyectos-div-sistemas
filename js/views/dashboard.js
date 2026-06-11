/* ============================================
   DASHBOARD VIEW - Executive Dashboard
   ============================================ */

const DashboardView = (() => {
  let statusChart = null;
  let priorityChart = null;
  let monthlyChart = null;
  let difficultyChart = null;
  let selectedMonthlyPeriod = '6';

  function render() {
    const allProjects = DataStore.getProjects();
    const projects = allProjects.filter(p => p.estado !== 'archivado');
    const team = DataStore.getTeam();
    const activeProjects = projects.filter(p => !['produccion', 'cancelado'].includes(p.estado));
    const completedProjects = projects.filter(p => p.estado === 'produccion');
    const inDevelopment = projects.filter(p => p.estado === 'desarrollo');
    const blocked = projects.filter(p => p.estado === 'pausado');
    const solicitudes = projects.filter(p => p.estado === 'solicitud');
    const avgProgress = activeProjects.length > 0
      ? Math.round(activeProjects.reduce((sum, p) => sum + (p.porcentajeAvance || 0), 0) / activeProjects.length)
      : 0;
    const totalDev = team.filter(m => m.activo).length;

    // New KPIs
    const criticalProjects = activeProjects.filter(p => p.prioridad === 'critica' || p.prioridad === 'alta');
    const totalEffort = activeProjects.reduce((sum, p) => sum + (p.dificultad || 0), 0);
    
    const allCompletedProjects = allProjects.filter(p => p.estado === 'produccion' || p.estado === 'archivado');
    let leadTimeDays = 0;
    let completedWithDates = 0;
    allCompletedProjects.forEach(p => {
      if (p.fechaSolicitud && p.fechaRealFin) {
        const start = new Date(p.fechaSolicitud);
        const end = new Date(p.fechaRealFin);
        const diffTime = end - start;
        if (diffTime >= 0) {
          leadTimeDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          completedWithDates++;
        }
      }
    });
    const avgLeadTime = completedWithDates > 0 ? Math.round(leadTimeDays / completedWithDates) : 0;
    
    const activeDevs = team.filter(m => m.activo);
    const avgProjectsPerDev = activeDevs.length > 0 ? (activeProjects.length / activeDevs.length).toFixed(1) : 0;

    const container = document.getElementById('page-content');
    container.innerHTML = `
      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card animate-slide-up stagger-1" style="cursor: pointer;" onclick="ProjectsView.setFilter('todos'); App.navigateTo('projects');" title="Ver todos los proyectos registrados">
          <div class="kpi-card-header">
            <div class="kpi-card-icon blue"><i data-lucide="folder-kanban"></i></div>
            <span class="kpi-card-trend neutral">Total</span>
          </div>
          <div class="kpi-card-value">${projects.length}</div>
          <div class="kpi-card-label">Proyectos Registrados</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-2" style="cursor: pointer;" onclick="ProjectsView.setFilter('solicitud'); App.navigateTo('projects');" title="Ver solicitudes de proyectos">
          <div class="kpi-card-header">
            <div class="kpi-card-icon purple"><i data-lucide="git-pull-request"></i></div>
            <span class="kpi-card-trend neutral">Nuevas</span>
          </div>
          <div class="kpi-card-value">${solicitudes.length}</div>
          <div class="kpi-card-label">Solicitudes</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-3" style="cursor: pointer;" onclick="ProjectsView.setFilter('desarrollo'); App.navigateTo('projects');" title="Ver proyectos en desarrollo">
          <div class="kpi-card-header">
            <div class="kpi-card-icon cyan"><i data-lucide="code-2"></i></div>
            <span class="kpi-card-trend up">Activos</span>
          </div>
          <div class="kpi-card-value">${inDevelopment.length}</div>
          <div class="kpi-card-label">En Desarrollo</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-4" style="cursor: pointer;" onclick="ProjectsView.setFilter('produccion'); App.navigateTo('projects');" title="Ver proyectos en producción">
          <div class="kpi-card-header">
            <div class="kpi-card-icon green"><i data-lucide="check-circle-2"></i></div>
            <span class="kpi-card-trend up">✓</span>
          </div>
          <div class="kpi-card-value">${completedProjects.length}</div>
          <div class="kpi-card-label">Nuevos en Producción (&lt;60d)</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-5" style="cursor: pointer;" onclick="ProjectsView.setFilter('pausado'); App.navigateTo('projects');" title="Ver proyectos pausados o bloqueados">
          <div class="kpi-card-header">
            <div class="kpi-card-icon orange"><i data-lucide="pause-circle"></i></div>
            <span class="kpi-card-trend ${blocked.length > 0 ? 'down' : 'neutral'}">${blocked.length > 0 ? '⚠' : '—'}</span>
          </div>
          <div class="kpi-card-value">${blocked.length}</div>
          <div class="kpi-card-label">Pausados / Bloqueados</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-6">
          <div class="kpi-card-header">
            <div class="kpi-card-icon purple"><i data-lucide="trending-up"></i></div>
          </div>
          <div class="kpi-card-value">${avgProgress}%</div>
          <div class="kpi-card-label">Avance Promedio (Activos)</div>
        </div>
        
        <!-- NEW KPIs -->
        <div class="kpi-card animate-slide-up stagger-7" style="border-left: 3px solid var(--status-red); cursor: help;" title="Proyectos contados:\n${criticalProjects.map(p => '- ' + p.nombre + ' (' + p.estado + ')').join('\n')}">
          <div class="kpi-card-header">
            <div class="kpi-card-icon red"><i data-lucide="alert-triangle"></i></div>
            <span class="kpi-card-trend down">Prioritarios</span>
          </div>
          <div class="kpi-card-value">${criticalProjects.length}</div>
          <div class="kpi-card-label">Proyectos Críticos / Altos</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-8">
          <div class="kpi-card-header">
            <div class="kpi-card-icon orange"><i data-lucide="weight"></i></div>
          </div>
          <div class="kpi-card-value">${totalEffort} <span style="font-size:1rem;color:var(--text-tertiary);">pts</span></div>
          <div class="kpi-card-label">Esfuerzo Total (Fibonacci)</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-9">
          <div class="kpi-card-header">
            <div class="kpi-card-icon cyan"><i data-lucide="timer"></i></div>
          </div>
          <div class="kpi-card-value">${avgLeadTime} <span style="font-size:1rem;color:var(--text-tertiary);">días</span></div>
          <div class="kpi-card-label">Lead Time Promedio</div>
        </div>
        <div class="kpi-card animate-slide-up stagger-10">
          <div class="kpi-card-header">
            <div class="kpi-card-icon blue"><i data-lucide="users"></i></div>
            <span class="kpi-card-trend ${avgProjectsPerDev > 3 ? 'down' : 'up'}">${avgProjectsPerDev > 3 ? 'Saturado' : 'Óptimo'}</span>
          </div>
          <div class="kpi-card-value">${avgProjectsPerDev} <span style="font-size:1rem;color:var(--text-tertiary);">proy/persona</span></div>
          <div class="kpi-card-label">Saturación del Equipo</div>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.2s">
        <div class="chart-card">
          <div class="chart-card-header" style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
            <div>
              <div class="chart-card-title">Evolución Mensual</div>
              <div id="monthly-chart-subtitle" class="chart-card-subtitle">Proyectos ingresados, en desarrollo y completados (${selectedMonthlyPeriod === '6' ? 'últimos 6 meses' : selectedMonthlyPeriod === '12' ? 'últimos 12 meses' : selectedMonthlyPeriod === '24' ? 'últimos 24 meses' : 'historial completo'})</div>
            </div>
            <div>
              <select id="monthly-chart-period" style="background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-subtle); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-family: 'Inter', sans-serif; cursor: pointer; outline: none; transition: border-color 0.2s;">
                <option value="6" ${selectedMonthlyPeriod === '6' ? 'selected' : ''}>Últimos 6 meses</option>
                <option value="12" ${selectedMonthlyPeriod === '12' ? 'selected' : ''}>Últimos 12 meses</option>
                <option value="24" ${selectedMonthlyPeriod === '24' ? 'selected' : ''}>Últimos 24 meses</option>
                <option value="all" ${selectedMonthlyPeriod === 'all' ? 'selected' : ''}>Histórico Completo</option>
              </select>
            </div>
          </div>
          <div class="chart-container" style="height: 280px">
            <canvas id="chart-monthly"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Distribución por Estado</div>
              <div class="chart-card-subtitle">Estado actual del pipeline</div>
            </div>
          </div>
          <div class="chart-container" style="height: 280px">
            <canvas id="chart-status"></canvas>
          </div>
        </div>
      </div>

      <!-- Charts Row 2 -->
      <div class="charts-grid charts-grid-equal animate-fade-in" style="animation-delay: 0.3s">
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Distribución por Prioridad</div>
              <div class="chart-card-subtitle">Clasificación de urgencia</div>
            </div>
          </div>
          <div class="chart-container" style="height: 260px">
            <canvas id="chart-priority"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Complejidad de Proyectos</div>
              <div class="chart-card-subtitle">Nivel de dificultad estimada</div>
            </div>
          </div>
          <div class="chart-container" style="height: 260px">
            <canvas id="chart-difficulty"></canvas>
          </div>
        </div>
      </div>

      <!-- Upcoming Deadlines + Recent Activity -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.4s">
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Próximas Entregas</div>
              <div class="chart-card-subtitle">Fechas estimadas de finalización (próximos 90 días)</div>
            </div>
          </div>
          <div id="upcoming-deadlines-list" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">Actividad Reciente</div>
              <div class="chart-card-subtitle">Últimos cambios en el sistema</div>
            </div>
          </div>
          <div id="recent-activity-list" style="max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>
    `;

    // Render icons
    if (window.lucide) lucide.createIcons();

    // Register monthly period filter event
    const periodSelect = document.getElementById('monthly-chart-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        selectedMonthlyPeriod = e.target.value;
        const subtitle = document.getElementById('monthly-chart-subtitle');
        if (subtitle) {
          if (selectedMonthlyPeriod === '6') subtitle.textContent = 'Proyectos ingresados, en desarrollo y completados (últimos 6 meses)';
          else if (selectedMonthlyPeriod === '12') subtitle.textContent = 'Proyectos ingresados, en desarrollo y completados (últimos 12 meses)';
          else if (selectedMonthlyPeriod === '24') subtitle.textContent = 'Proyectos ingresados, en desarrollo y completados (últimos 24 meses)';
          else subtitle.textContent = 'Proyectos ingresados, en desarrollo y completados (historial completo)';
        }
        renderMonthlyChart();
      });
    }

    // Render charts
    setTimeout(() => {
      renderStatusChart();
      renderPriorityChart();
      renderMonthlyChart();
      renderDifficultyChart();
      renderUpcomingDeadlines();
      renderRecentActivity();
    }, 100);
  }

  function renderStatusChart() {
    const byStatus = DataStore.getProjectsByStatus();
    const statuses = DataStore.STATUSES;
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: statuses.map(s => s.label),
        datasets: [{
          data: statuses.map(s => byStatus[s.id] || 0),
          backgroundColor: statuses.map(s => s.color + '99'),
          borderColor: statuses.map(s => s.color),
          borderWidth: 2,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        onClick: (event, elements) => {
          if (!elements || elements.length === 0) return;
          const el = elements[0];
          const status = statuses[el.index];
          if (status) {
            ProjectsView.setFilter(status.id);
            App.navigateTo('projects');
          }
        },
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#94a3b8',
              font: { family: 'Inter', size: 11 },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          }
        }
      }
    });
    ctx.style.cursor = 'pointer';
  }

  function renderPriorityChart() {
    const byPriority = DataStore.getProjectsByPriority();
    const priorities = DataStore.PRIORITIES;
    const ctx = document.getElementById('chart-priority');
    if (!ctx) return;

    if (priorityChart) priorityChart.destroy();
    priorityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: priorities.map(p => p.label),
        datasets: [{
          label: 'Proyectos',
          data: priorities.map(p => byPriority[p.id] || 0),
          backgroundColor: priorities.map(p => p.color + '66'),
          borderColor: priorities.map(p => p.color),
          borderWidth: 2,
          borderRadius: 6,
          barThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(99, 102, 241, 0.06)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, stepSize: 1 }
          }
        }
      }
    });
  }

  function renderMonthlyChart() {
    const monthlyData = DataStore.getMonthlyStats(selectedMonthlyPeriod);
    const monthKeys = Object.keys(monthlyData);
    const labels = monthKeys.map(k => monthlyData[k].label);
    const created = monthKeys.map(k => monthlyData[k].created);
    const completed = monthKeys.map(k => monthlyData[k].completed);
    const desarrollo = monthKeys.map(k => monthlyData[k].desarrollo || 0);
    const ctx = document.getElementById('chart-monthly');
    if (!ctx) return;

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Ingresados',
            data: created,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#6366f1',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#818cf8',
            pointCursor: 'pointer'
          },
          {
            label: 'En Desarrollo',
            data: desarrollo,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#06b6d4',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#22d3ee',
            pointCursor: 'pointer'
          },
          {
            label: 'Completados',
            data: completed,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#22c55e',
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHoverBackgroundColor: '#4ade80',
            pointCursor: 'pointer'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (!elements || elements.length === 0) return;
          const el = elements[0];
          const monthKey = monthKeys[el.index];
          let datasetType = 'ingresados';
          if (el.datasetIndex === 1) {
            datasetType = 'desarrollo';
          } else if (el.datasetIndex === 2) {
            datasetType = 'completados';
          }
          const label = monthlyData[monthKey].label;
          openMonthlyDrilldown(monthKey, datasetType, label);
        },
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              afterLabel: () => '\uD83D\uDD0D Click para ver detalle'
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(99, 102, 241, 0.06)' },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, stepSize: 1 }
          }
        },
        interaction: { mode: 'nearest', intersect: true }
      }
    });
    // Change cursor on hover
    ctx.style.cursor = 'pointer';
  }

  /* ── Monthly Drilldown Modal ── */
  function openMonthlyDrilldown(monthKey, type, monthLabel) {
    const allProjects = DataStore.getProjects();
    let projects;
    let typeLabel, typeColor, typeIcon;

    if (type === 'ingresados') {
      projects = allProjects.filter(p => {
        const key = (p.fechaSolicitud || p.createdAt || '').substring(0, 7);
        return key === monthKey;
      });
      typeLabel = 'Ingresados';
      typeColor = '#6366f1';
      typeIcon = '📥';
    } else if (type === 'desarrollo') {
      projects = allProjects.filter(p => {
        const start = p.fechaRealInicio || p.fechaEstimadaInicio;
        if (!start) return false;
        const startMonth = start.substring(0, 7);
        if (startMonth > monthKey) return false;

        // If it has a real end date (finished or cancelled)
        if (p.fechaRealFin) {
          const endMonth = p.fechaRealFin.substring(0, 7);
          if (endMonth <= monthKey) return false;
        } else {
          // If it is completed or cancelled but has no real end date, check estimated finish date or state
          if (['produccion', 'cancelado'].includes(p.estado)) {
            const estFin = p.fechaEstimadaFin;
            if (estFin) {
              const estFinMonth = estFin.substring(0, 7);
              if (estFinMonth <= monthKey) return false;
            } else {
              return false; // Completed/cancelled with no end dates, assume not active
            }
          }
          
          // If it's a new request or backlog, it hasn't actually started development
          if (['solicitud', 'backlog'].includes(p.estado)) {
            return false;
          }
        }
        return true;
      });
      typeLabel = 'En Desarrollo';
      typeColor = '#06b6d4';
      typeIcon = '💻';
    } else {
      projects = allProjects.filter(p => {
        const key = (p.fechaRealFin || '').substring(0, 7);
        return key === monthKey;
      });
      typeLabel = 'Completados';
      typeColor = '#22c55e';
      typeIcon = '✅';
    }

    renderMonthlyDrilldown(projects, monthLabel, typeLabel, typeColor, typeIcon, type);
  }

  function calcDuration(p) {
    const start = p.fechaRealInicio || p.fechaEstimadaInicio;
    const end = p.fechaRealFin || p.fechaEstimadaFin;
    if (!start || !end) return null;
    const ms = new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00');
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    return days >= 0 ? days : null;
  }

  function renderMonthlyDrilldown(projects, monthLabel, typeLabel, typeColor, typeIcon, type) {
    // Remove any existing modal
    const existing = document.getElementById('monthly-drilldown-overlay');
    if (existing) existing.remove();

    const totalDevDays = projects.reduce((sum, p) => {
      const dur = calcDuration(p);
      const devCount = (p.desarrolladores || []).length +
        (p.pm ? 1 : 0) + (p.liderTecnico ? 1 : 0) +
        (p.scrumMaster ? 1 : 0) + (p.productOwner ? 1 : 0);
      return sum + (dur !== null ? dur * Math.max(devCount, 1) : 0);
    }, 0);

    const avgProgress = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.porcentajeAvance || 0), 0) / projects.length)
      : 0;

    const peopleSet = new Set();
    projects.forEach(p => {
      if (p.pm) peopleSet.add(p.pm);
      if (p.liderTecnico) peopleSet.add(p.liderTecnico);
      if (p.scrumMaster) peopleSet.add(p.scrumMaster);
      if (p.productOwner) peopleSet.add(p.productOwner);
      (p.desarrolladores || []).forEach(id => peopleSet.add(id));
    });

    const cardsHTML = projects.length === 0
      ? `<div class="drilldown-empty">📊 No hay proyectos para este período</div>`
      : projects.map(p => {
          const statusInfo = DataStore.getStatusInfo(p.estado);
          const prioInfo = DataStore.getPriorityInfo(p.prioridad);
          const diffInfo = DataStore.getDifficultyInfo(p.dificultad);
          const dur = calcDuration(p);

          const devIds = p.desarrolladores || [];
          const allPeople = [
            p.pm && { role: 'PM', name: DataStore.getTeamMemberName(p.pm) },
            p.liderTecnico && { role: 'Líder Téc.', name: DataStore.getTeamMemberName(p.liderTecnico) },
            p.scrumMaster && { role: 'Scrum', name: DataStore.getTeamMemberName(p.scrumMaster) },
            p.productOwner && { role: 'PO', name: DataStore.getTeamMemberName(p.productOwner) },
            ...devIds.map(id => ({ role: 'Dev', name: DataStore.getTeamMemberName(id) }))
          ].filter(Boolean);

          const personCount = allPeople.length;
          const devDays = dur !== null ? dur * Math.max(personCount, 1) : null;

          const startDate = p.fechaRealInicio || p.fechaEstimadaInicio;
          const endDate   = type === 'completados' ? (p.fechaRealFin || p.fechaEstimadaFin) : p.fechaEstimadaFin;

          return `
          <div class="drilldown-card">
            <div class="drilldown-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
              <div style="flex: 1;">
                <div class="drilldown-card-title" style="display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                  <span class="drilldown-card-name" style="word-break: break-word; font-weight: 700; color: var(--text-primary); font-size: 1.05rem; line-height: 1.4;">${p.nombre}</span>
                  <div class="drilldown-card-badges" style="display: inline-flex; gap: 4px; align-items: center; flex-wrap: wrap; margin-top: 2px;">
                    <span class="badge badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
                    <span class="badge ${prioInfo.badgeClass}">${prioInfo.label}</span>
                  </div>
                </div>
                <div class="drilldown-card-area" style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">${p.areaSolicitante || ''} ${p.expediente ? '&bull; <span style="font-family:monospace;">' + p.expediente + '</span>' : ''}</div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="DashboardView.editProjectFromDrilldown('${p.id}')" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 0.75rem; border-radius: 6px; background: rgba(255, 255, 255, 0.05); color: var(--text-secondary); border: 1px solid var(--border-subtle); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(99, 102, 241, 0.1)'; this.style.color='var(--primary-400)';" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.color='var(--text-secondary)';">
                <i data-lucide="pencil" style="width:13px;height:13px;"></i>
                <span>Editar</span>
              </button>
            </div>

            <div class="drilldown-card-body">
              <!-- Timeline -->
              <div class="drilldown-section">
                <div class="drilldown-section-title">⏱ Tiempo</div>
                <div class="drilldown-metrics">
                  <div class="drilldown-metric">
                    <span class="drilldown-metric-val" style="color:#818cf8">${dur !== null ? dur + ' días' : '—'}</span>
                    <span class="drilldown-metric-lbl">Duración</span>
                  </div>
                  <div class="drilldown-metric">
                    <span class="drilldown-metric-val" style="color:#f97316">${devDays !== null ? devDays + ' p-días' : '—'}</span>
                    <span class="drilldown-metric-lbl">Persona-Días</span>
                  </div>
                  <div class="drilldown-metric">
                    <span class="drilldown-metric-val">${formatDate(startDate)}</span>
                    <span class="drilldown-metric-lbl">Inicio</span>
                  </div>
                  <div class="drilldown-metric">
                    <span class="drilldown-metric-val">${formatDate(endDate)}</span>
                    <span class="drilldown-metric-lbl">${type === 'completados' ? 'Completado' : 'Est. Fin'}</span>
                  </div>
                </div>
              </div>

              <!-- Progress & Difficulty -->
              <div class="drilldown-section">
                <div class="drilldown-section-title">📊 Avance y Complejidad</div>
                <div class="drilldown-metrics">
                  <div class="drilldown-metric" style="flex:2;">
                    <div style="display:flex;align-items:center;gap:8px;width:100%;">
                      <div style="flex:1;background:rgba(99,102,241,0.15);border-radius:4px;height:8px;">
                        <div style="width:${p.porcentajeAvance}%;background:${typeColor};height:8px;border-radius:4px;transition:width .4s"></div>
                      </div>
                      <span style="font-weight:700;color:${typeColor};min-width:36px;">${p.porcentajeAvance}%</span>
                    </div>
                    <span class="drilldown-metric-lbl">Avance</span>
                  </div>
                  <div class="drilldown-metric">
                    <span class="drilldown-metric-val" style="color:${diffInfo.color}">${p.dificultad} — ${diffInfo.label}</span>
                    <span class="drilldown-metric-lbl">Complejidad (Fibonacci)</span>
                  </div>
                  ${p.sprintActual ? `<div class="drilldown-metric"><span class="drilldown-metric-val">${p.sprintActual}</span><span class="drilldown-metric-lbl">Sprint</span></div>` : ''}
                </div>
              </div>

              <!-- Team -->
              ${allPeople.length > 0 ? `
              <div class="drilldown-section">
                <div class="drilldown-section-title">👥 Equipo (${personCount} personas)</div>
                <div class="drilldown-team-grid">
                  ${allPeople.map(m => `
                    <div class="drilldown-team-pill">
                      <span class="drilldown-team-role">${m.role}</span>
                      <span class="drilldown-team-name">${m.name}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
              ` : ''}

              <!-- Tags -->
              ${p.tags && p.tags.length > 0 ? `
              <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:4px;">
                ${p.tags.map(t => `<span style="font-size:0.68rem;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,0.12);color:var(--primary-400);">#${t}</span>`).join('')}
              </div>` : ''}

              ${p.observaciones ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.75rem;color:var(--text-tertiary);border-left:3px solid var(--border-medium);">&#128221; ${p.observaciones}</div>` : ''}
            </div>
          </div>`;
        }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'monthly-drilldown-overlay';
    overlay.className = 'drilldown-overlay';
    overlay.innerHTML = `
      <div class="drilldown-modal">
        <div class="drilldown-modal-header" style="border-bottom: 2px solid ${typeColor}33;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.5rem;">${typeIcon}</span>
              <div>
                <h2 class="drilldown-title">${typeLabel} en ${monthLabel}</h2>
                <p class="drilldown-subtitle">${projects.length} proyecto${projects.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            <!-- Summary stats -->
            <div class="drilldown-summary">
              <div class="drilldown-summary-item">
                <span style="color:${typeColor};font-size:1.4rem;font-weight:700;">${projects.length}</span>
                <span>Proyectos</span>
              </div>
              <div class="drilldown-summary-item">
                <span style="color:#f97316;font-size:1.4rem;font-weight:700;">${totalDevDays}</span>
                <span>Persona-Días</span>
              </div>
              <div class="drilldown-summary-item">
                <span style="color:#818cf8;font-size:1.4rem;font-weight:700;">${peopleSet.size}</span>
                <span>Personas involucradas</span>
              </div>
              <div class="drilldown-summary-item">
                <span style="color:#22c55e;font-size:1.4rem;font-weight:700;">${avgProgress}%</span>
                <span>Avance promedio</span>
              </div>
            </div>
            <button class="drilldown-close" onclick="DashboardView.closeMonthlyDrilldown()">✕</button>
          </div>
        </div>
        <div class="drilldown-modal-body">
          ${cardsHTML}
        </div>
      </div>
    `;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) DashboardView.closeMonthlyDrilldown();
    });
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    requestAnimationFrame(() => overlay.classList.add('active'));
  }

  function closeMonthlyDrilldown() {
    const overlay = document.getElementById('monthly-drilldown-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 280);
    }
  }

  function renderDifficultyChart() {
    const projects = DataStore.getProjects().filter(p => p.estado !== 'archivado');
    const scale = DataStore.DIFFICULTY_SCALE;
    const counts = scale.map(d => projects.filter(p => p.dificultad === d.value).length);
    const ctx = document.getElementById('chart-difficulty');
    if (!ctx) return;

    if (difficultyChart) difficultyChart.destroy();
    difficultyChart = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: scale.map(d => `${d.label} (${d.value})`),
        datasets: [{
          data: counts,
          backgroundColor: scale.map(d => d.color + '55'),
          borderColor: scale.map(d => d.color),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, usePointStyle: true, padding: 10 }
          }
        },
        scales: {
          r: {
            grid: { color: 'rgba(99, 102, 241, 0.08)' },
            ticks: { display: false }
          }
        }
      }
    });
  }

  function renderUpcomingDeadlines() {
    const deadlines = DataStore.getUpcomingDeadlines(90);
    const container = document.getElementById('upcoming-deadlines-list');
    if (!container) return;

    if (deadlines.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px 20px;">
          <div class="empty-state-icon">📅</div>
          <h3>Sin entregas próximas</h3>
          <p>No hay proyectos con fechas de entrega en los próximos 90 días.</p>
        </div>
      `;
      return;
    }

    const now = new Date();
    container.innerHTML = '<div class="timeline">' + deadlines.map(p => {
      const deadline = new Date(p.fechaEstimadaFin);
      const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const isOverdue = daysLeft < 0;
      const isUrgent = daysLeft >= 0 && daysLeft <= 7;
      const statusInfo = DataStore.getStatusInfo(p.estado);
      const prioInfo = DataStore.getPriorityInfo(p.prioridad);

      let dotClass, dotBg;
      if (isOverdue) { dotBg = 'var(--status-red-bg)'; dotClass = 'color: var(--status-red)'; }
      else if (isUrgent) { dotBg = 'var(--status-orange-bg)'; dotClass = 'color: var(--status-orange)'; }
      else { dotBg = 'var(--status-blue-bg)'; dotClass = 'color: var(--status-blue)'; }

      return `
        <div class="timeline-item">
          <div class="timeline-dot" style="background: ${dotBg}; ${dotClass}">
            ${isOverdue ? '⚠' : '📅'}
          </div>
          <div class="timeline-content">
            <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
              ${p.nombre}
              <span class="badge badge-status ${prioInfo.badgeClass}" style="margin-left: 6px;">${prioInfo.label}</span>
            </p>
            <p>
              <span class="badge badge-status ${statusInfo.badgeClass}">${statusInfo.label}</span>
              <span style="margin-left: 8px; font-size: 0.72rem; color: ${isOverdue ? 'var(--status-red)' : isUrgent ? 'var(--status-orange)' : 'var(--text-tertiary)'}; font-weight: 600;">
                ${isOverdue ? `⚠ Vencido hace ${Math.abs(daysLeft)} días` : `${daysLeft} días restantes`}
              </span>
            </p>
            <time>${formatDate(p.fechaEstimadaFin)}</time>
          </div>
        </div>
      `;
    }).join('') + '</div>';
  }

  function renderRecentActivity() {
    const history = DataStore.getHistory().slice(0, 15);
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    if (history.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px 20px;">
          <div class="empty-state-icon">📋</div>
          <h3>Sin actividad</h3>
          <p>Aún no se registró actividad en el sistema.</p>
        </div>
      `;
      return;
    }

    const actionIcons = { create: '➕', update: '✏️', delete: '🗑️', import: '📥' };
    const actionColors = {
      create: 'var(--status-green-bg)',
      update: 'var(--status-blue-bg)',
      delete: 'var(--status-red-bg)',
      import: 'var(--status-purple-bg)'
    };

    container.innerHTML = '<div class="timeline">' + history.map(h => `
      <div class="timeline-item">
        <div class="timeline-dot" style="background: ${actionColors[h.action] || 'var(--status-gray-bg)'};">
          ${actionIcons[h.action] || '📌'}
        </div>
        <div class="timeline-content">
          <p>${h.description}</p>
          <time>${formatDateTime(h.timestamp)}</time>
        </div>
      </div>
    `).join('') + '</div>';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function editProjectFromDrilldown(projectId) {
    closeMonthlyDrilldown();
    App.navigateTo('projects');
    setTimeout(() => {
      ProjectsView.openForm(projectId);
    }, 120);
  }

  function destroy() {
    [statusChart, priorityChart, monthlyChart, difficultyChart].forEach(c => { if (c) c.destroy(); });
    statusChart = priorityChart = monthlyChart = difficultyChart = null;
  }

  return { render, destroy, closeMonthlyDrilldown, editProjectFromDrilldown };
})();
