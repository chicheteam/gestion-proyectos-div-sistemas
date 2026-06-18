/* ============================================
   DASHBOARD VIEW - Centro de Comando Ejecutivo
   División Sistemas Informáticos
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

    // KPIs
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

    // ── Compute alert data ──
    const alerts = computeAlerts(projects, team);
    const semaphoreData = computeSemaphore(projects, team, activeProjects, blocked, solicitudes);
    const pipelineData = computePipeline(projects);
    const execSummary = generateExecutiveSummary(projects, activeProjects, blocked, solicitudes, team, alerts, criticalProjects);
    const throughputData = computeThroughput(allProjects);
    const atRiskProjects = computeAtRiskProjects(activeProjects);

    const container = document.getElementById('page-content');
    container.innerHTML = `
      <!-- 1. Critical Alerts Banner -->
      ${renderAlertsBanner(alerts)}

      <!-- 2. Executive Summary -->
      ${renderExecSummary(execSummary)}

      <!-- 3. Traffic Light Semaphore -->
      ${renderSemaphore(semaphoreData)}

      <!-- 4. Pipeline Visual + KPI Cards -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.15s; grid-template-columns: 1fr 1fr;">
        <div>
          ${renderPipeline(pipelineData)}
        </div>
        <div>
          <!-- KPI Cards (compact 2-col grid) -->
          <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div class="kpi-card" style="cursor: pointer; padding: 14px;" onclick="ProjectsView.setFilter('todos'); App.navigateTo('projects');" title="Ver todos los proyectos registrados">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon blue"><i data-lucide="folder-kanban"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${projects.length}</div>
              <div class="kpi-card-label">Proyectos Registrados</div>
            </div>
            <div class="kpi-card" style="cursor: pointer; padding: 14px;" onclick="ProjectsView.setFilter('solicitud'); App.navigateTo('projects');" title="Ver solicitudes">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon purple"><i data-lucide="git-pull-request"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${solicitudes.length}</div>
              <div class="kpi-card-label">Solicitudes</div>
            </div>
            <div class="kpi-card" style="cursor: pointer; padding: 14px;" onclick="ProjectsView.setFilter('desarrollo'); App.navigateTo('projects');" title="Ver proyectos en desarrollo">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon cyan"><i data-lucide="code-2"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${inDevelopment.length}</div>
              <div class="kpi-card-label">En Desarrollo</div>
            </div>
            <div class="kpi-card" style="cursor: pointer; padding: 14px;" onclick="ProjectsView.setFilter('produccion'); App.navigateTo('projects');" title="Ver proyectos en producción">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon green"><i data-lucide="check-circle-2"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${completedProjects.length}</div>
              <div class="kpi-card-label">En Producción</div>
            </div>
            <div class="kpi-card" style="cursor: pointer; padding: 14px; border-left: 3px solid var(--status-orange);" onclick="ProjectsView.setFilter('pausado'); App.navigateTo('projects');" title="Ver pausados / bloqueados">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon orange"><i data-lucide="pause-circle"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${blocked.length}</div>
              <div class="kpi-card-label">Pausados / Bloqueados</div>
            </div>
            <div class="kpi-card" style="padding: 14px; border-left: 3px solid var(--status-red);" title="Proyectos Críticos / Altos activos">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon red"><i data-lucide="alert-triangle"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${criticalProjects.length}</div>
              <div class="kpi-card-label">Críticos / Altos</div>
            </div>
            <div class="kpi-card" style="padding: 14px;">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon purple"><i data-lucide="trending-up"></i></div>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${avgProgress}%</div>
              <div class="kpi-card-label">Avance Promedio</div>
            </div>
            <div class="kpi-card" style="padding: 14px;">
              <div class="kpi-card-header" style="margin-bottom: 8px;">
                <div class="kpi-card-icon blue"><i data-lucide="users"></i></div>
                <span class="kpi-card-trend ${avgProjectsPerDev > 3 ? 'down' : 'up'}">${avgProjectsPerDev > 3 ? 'Saturado' : 'Óptimo'}</span>
              </div>
              <div class="kpi-card-value" style="font-size: 1.6rem;">${avgProjectsPerDev}</div>
              <div class="kpi-card-label">Proy/Persona</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts Row 1 -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.25s">
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
      <div class="charts-grid charts-grid-equal animate-fade-in" style="animation-delay: 0.35s">
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

      <!-- 5. Team Heatmap + 6. Enhanced Deadlines -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.45s">
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">🌡️ Mapa de Calor del Equipo</div>
              <div class="chart-card-subtitle">Saturación y disponibilidad del personal</div>
            </div>
          </div>
          <div id="team-heatmap-container" style="max-height: 400px; overflow-y: auto;"></div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">📅 Próximas Entregas</div>
              <div class="chart-card-subtitle">Fechas estimadas con semáforo de riesgo</div>
            </div>
          </div>
          <div id="upcoming-deadlines-list" style="max-height: 400px; overflow-y: auto;"></div>
        </div>
      </div>

      <!-- 7. Throughput KPIs + At-Risk Projects + Activity -->
      <div class="charts-grid animate-fade-in" style="animation-delay: 0.55s">
        <div class="chart-card">
          <div class="chart-card-header">
            <div>
              <div class="chart-card-title">📈 Rendimiento y Velocidad</div>
              <div class="chart-card-subtitle">Throughput, ratio ingreso/egreso y proyectos en riesgo</div>
            </div>
          </div>
          <div id="throughput-container"></div>
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

    // Setup alerts toggle
    const alertsHeader = document.getElementById('dash-alerts-toggle');
    if (alertsHeader) {
      alertsHeader.addEventListener('click', () => {
        const body = document.getElementById('dash-alerts-body');
        const arrow = document.getElementById('dash-alerts-arrow');
        if (body) body.classList.toggle('open');
        if (arrow) arrow.classList.toggle('open');
      });
    }

    // Render dynamic sections
    setTimeout(() => {
      renderStatusChart();
      renderPriorityChart();
      renderMonthlyChart();
      renderDifficultyChart();
      renderTeamHeatmap();
      renderUpcomingDeadlines();
      renderThroughputSection(throughputData, atRiskProjects);
      renderRecentActivity();
    }, 100);
  }

  /* ════════════════════════════════════════════
     COMPUTE FUNCTIONS
     ════════════════════════════════════════════ */

  function computeAlerts(projects, team) {
    const now = new Date();
    const result = { overdue: [], urgent7d: [], saturated: [], noTeam: [], total: 0 };

    projects.forEach(p => {
      if (['produccion', 'cancelado', 'archivado'].includes(p.estado)) return;
      const dateStr = p.fechaEstimadaFin;
      if (!dateStr) return;
      const deadline = new Date(dateStr + 'T12:00:00');
      const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        result.overdue.push({ project: p, days: Math.abs(daysLeft) });
      } else if (daysLeft <= 7) {
        result.urgent7d.push({ project: p, days: daysLeft });
      }
    });

    // Saturated team
    const workloads = DataStore.getTeamWorkload();
    workloads.forEach(w => {
      if (w.count >= w.max && w.count > 0) {
        result.saturated.push(w);
      }
    });

    // Projects in dev/testing without team
    projects.forEach(p => {
      if (!['desarrollo', 'testing'].includes(p.estado)) return;
      const hasTeam = p.pm || p.liderTecnico || p.scrumMaster || p.productOwner || p.analistaFuncional || p.qaTester || p.dba || p.uxuiDesigner || (p.desarrolladores && p.desarrolladores.length > 0);
      if (!hasTeam) result.noTeam.push(p);
    });

    result.total = result.overdue.length + result.urgent7d.length + result.saturated.length + result.noTeam.length;
    return result;
  }

  function computeSemaphore(projects, team, activeProjects, blocked, solicitudes) {
    const workloads = DataStore.getTeamWorkload();
    const activeWorkloads = workloads.filter(w => w.count > 0 || w.member.activo);
    
    // Team Load
    const avgLoad = activeWorkloads.length > 0
      ? Math.round(activeWorkloads.reduce((s, w) => s + w.loadPercentage, 0) / activeWorkloads.length)
      : 0;
    const teamLoadColor = avgLoad > 85 ? 'red' : avgLoad > 60 ? 'yellow' : 'green';

    // On-time delivery
    const now = new Date();
    let onTimeCount = 0, totalWithDeadline = 0;
    activeProjects.forEach(p => {
      if (!p.fechaEstimadaFin) return;
      totalWithDeadline++;
      const deadline = new Date(p.fechaEstimadaFin + 'T12:00:00');
      if (deadline >= now) onTimeCount++;
    });
    const onTimePercent = totalWithDeadline > 0 ? Math.round((onTimeCount / totalWithDeadline) * 100) : 100;
    const onTimeColor = onTimePercent < 50 ? 'red' : onTimePercent < 80 ? 'yellow' : 'green';

    // Blocked projects
    const blockedColor = blocked.length >= 3 ? 'red' : blocked.length >= 1 ? 'yellow' : 'green';

    // Pending requests
    const solColor = solicitudes.length >= 6 ? 'red' : solicitudes.length >= 3 ? 'yellow' : 'green';

    // Projects without team
    const noTeamCount = activeProjects.filter(p => {
      if (!['desarrollo', 'testing', 'analisis'].includes(p.estado)) return false;
      return !(p.pm || p.liderTecnico || p.scrumMaster || p.productOwner || p.analistaFuncional || p.qaTester || p.dba || p.uxuiDesigner || (p.desarrolladores && p.desarrolladores.length > 0));
    }).length;
    const noTeamColor = noTeamCount >= 2 ? 'red' : noTeamCount >= 1 ? 'yellow' : 'green';

    return [
      { label: 'Carga del Equipo', value: `${avgLoad}% promedio`, color: teamLoadColor },
      { label: 'Entregas a Tiempo', value: `${onTimePercent}% (${onTimeCount}/${totalWithDeadline})`, color: onTimeColor },
      { label: 'Proyectos Bloqueados', value: `${blocked.length} pausado${blocked.length !== 1 ? 's' : ''}`, color: blockedColor },
      { label: 'Solicitudes Pendientes', value: `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''}`, color: solColor },
      { label: 'Sin Equipo Asignado', value: `${noTeamCount} proyecto${noTeamCount !== 1 ? 's' : ''}`, color: noTeamColor }
    ];
  }

  function computePipeline(projects) {
    const filtered = projects.filter(p => p.estado !== 'archivado');
    const stages = [
      { id: 'solicitud', label: 'Solicitud', color: '#64748b' },
      { id: 'backlog', label: 'Backlog', color: '#3b82f6' },
      { id: 'analisis', label: 'Análisis', color: '#a855f7' },
      { id: 'desarrollo', label: 'Desarrollo', color: '#06b6d4' },
      { id: 'testing', label: 'Testing', color: '#eab308' },
      { id: 'produccion', label: 'Producción', color: '#22c55e' }
    ];
    const maxCount = Math.max(...stages.map(s => filtered.filter(p => p.estado === s.id).length), 1);

    return stages.map(s => ({
      ...s,
      count: filtered.filter(p => p.estado === s.id).length,
      percent: Math.round((filtered.filter(p => p.estado === s.id).length / maxCount) * 100)
    }));
  }

  function generateExecutiveSummary(projects, activeProjects, blocked, solicitudes, team, alerts, criticalProjects) {
    const activeDevs = team.filter(m => m.activo);
    const workloads = DataStore.getTeamWorkload();
    const saturatedNames = alerts.saturated.map(w => w.fullName.split(' ').slice(-1)[0]).slice(0, 3);
    const availableCount = workloads.filter(w => w.member.activo && w.count <= 2).length;

    // Determine overall level
    let level = 'ok';
    let levelLabel = 'BAJO CONTROL';
    let levelIcon = '🟢';
    if (alerts.overdue.length >= 1 || alerts.saturated.length >= 2 || criticalProjects.length >= 3) {
      level = 'critical'; levelLabel = 'ATENCIÓN URGENTE'; levelIcon = '🔴';
    } else if (alerts.urgent7d.length >= 2 || alerts.saturated.length >= 1 || solicitudes.length >= 4 || blocked.length >= 2) {
      level = 'warning'; levelLabel = 'ATENCIÓN'; levelIcon = '🟡';
    }

    // Build narrative
    const lines = [];
    lines.push(`La oficina gestiona actualmente <strong>${activeProjects.length} proyectos activos</strong> con <strong>${activeDevs.length} personas</strong> en el equipo.`);

    if (alerts.overdue.length > 0) {
      const overdueNames = alerts.overdue.slice(0, 2).map(a => `"${a.project.nombre}"`).join(', ');
      lines.push(`Hay <span class="highlight-red">${alerts.overdue.length} entrega${alerts.overdue.length > 1 ? 's' : ''} vencida${alerts.overdue.length > 1 ? 's' : ''}</span> que ${alerts.overdue.length > 1 ? 'requieren' : 'requiere'} atención inmediata: ${overdueNames}.`);
    }

    if (alerts.urgent7d.length > 0) {
      lines.push(`Se aproximan <span class="highlight-orange">${alerts.urgent7d.length} entrega${alerts.urgent7d.length > 1 ? 's' : ''}</span> en los próximos 7 días.`);
    }

    if (alerts.saturated.length > 0) {
      lines.push(`Hay <span class="highlight-red">${alerts.saturated.length} persona${alerts.saturated.length > 1 ? 's' : ''} saturada${alerts.saturated.length > 1 ? 's' : ''}</span> (${saturatedNames.join(', ')}). Se recomienda redistribuir carga.`);
    }

    if (availableCount > 0) {
      lines.push(`<span class="highlight-green">${availableCount} persona${availableCount > 1 ? 's' : ''}</span> con disponibilidad para asumir nuevos proyectos.`);
    }

    if (solicitudes.length > 0) {
      lines.push(`Se registran <strong>${solicitudes.length} solicitud${solicitudes.length > 1 ? 'es' : ''} nueva${solicitudes.length > 1 ? 's' : ''}</strong> pendientes de asignación.`);
    }

    if (blocked.length > 0) {
      const blockedNames = blocked.slice(0, 2).map(p => `"${p.nombre}"`).join(', ');
      lines.push(`<span class="highlight-orange">${blocked.length} proyecto${blocked.length > 1 ? 's' : ''} pausado${blocked.length > 1 ? 's' : ''}</span>: ${blockedNames}.`);
    }

    if (criticalProjects.length > 0) {
      lines.push(`Proyectos de prioridad crítica/alta en curso: <strong>${criticalProjects.length}</strong>.`);
    }

    return { level, levelLabel, levelIcon, narrative: lines.join(' ') };
  }

  function computeThroughput(allProjects) {
    const now = new Date();
    const months3ago = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const months6ago = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    // Completed in last 3 months
    const completedRecent = allProjects.filter(p => {
      if (!p.fechaRealFin) return false;
      return new Date(p.fechaRealFin) >= months3ago && (p.estado === 'produccion' || p.estado === 'archivado');
    });
    const throughputPerMonth = completedRecent.length > 0 ? (completedRecent.length / 3).toFixed(1) : '0';

    // Created in last 3 months
    const createdRecent = allProjects.filter(p => {
      const date = p.fechaSolicitud || p.createdAt;
      if (!date) return false;
      return new Date(date) >= months3ago;
    });
    const ingressPerMonth = createdRecent.length > 0 ? (createdRecent.length / 3).toFixed(1) : '0';

    // Ratio
    const ratio = parseFloat(ingressPerMonth) > 0
      ? (parseFloat(ingressPerMonth) / Math.max(parseFloat(throughputPerMonth), 0.1)).toFixed(1)
      : '0';

    return { throughputPerMonth, ingressPerMonth, ratio };
  }

  function computeAtRiskProjects(activeProjects) {
    const now = new Date();
    const results = [];

    activeProjects.forEach(p => {
      const startStr = p.fechaRealInicio || p.fechaEstimadaInicio;
      const endStr = p.fechaEstimadaFin;
      if (!startStr || !endStr) return;

      const start = new Date(startStr + 'T12:00:00');
      const end = new Date(endStr + 'T12:00:00');
      const totalDays = Math.max((end - start) / (1000 * 60 * 60 * 24), 1);
      const elapsed = Math.max((now - start) / (1000 * 60 * 60 * 24), 0);
      const expectedProgress = Math.min(Math.round((elapsed / totalDays) * 100), 100);
      const actualProgress = p.porcentajeAvance || 0;
      const gap = expectedProgress - actualProgress;

      if (gap >= 20 && expectedProgress > 10) {
        results.push({
          project: p,
          expectedProgress,
          actualProgress,
          gap
        });
      }
    });

    results.sort((a, b) => b.gap - a.gap);
    return results.slice(0, 6);
  }

  /* ════════════════════════════════════════════
     RENDER FUNCTIONS — Static HTML generators
     ════════════════════════════════════════════ */

  function renderAlertsBanner(alerts) {
    const hasAlerts = alerts.total > 0;
    const bannerClass = hasAlerts ? '' : 'status-ok';
    const icon = hasAlerts ? '🚨' : '✅';
    const title = hasAlerts ? `${alerts.total} Alerta${alerts.total > 1 ? 's' : ''} Activa${alerts.total > 1 ? 's' : ''}` : 'Sin Alertas Críticas';
    const subtitle = hasAlerts ? 'Click para ver detalle' : 'Todo bajo control';

    let badges = '';
    if (alerts.overdue.length > 0) badges += `<span class="dash-alert-badge red">⚠ ${alerts.overdue.length} Vencida${alerts.overdue.length > 1 ? 's' : ''}</span>`;
    if (alerts.urgent7d.length > 0) badges += `<span class="dash-alert-badge orange">📅 ${alerts.urgent7d.length} Próxima${alerts.urgent7d.length > 1 ? 's' : ''}</span>`;
    if (alerts.saturated.length > 0) badges += `<span class="dash-alert-badge yellow">🔥 ${alerts.saturated.length} Saturado${alerts.saturated.length > 1 ? 's' : ''}</span>`;
    if (alerts.noTeam.length > 0) badges += `<span class="dash-alert-badge blue">👤 ${alerts.noTeam.length} Sin Equipo</span>`;
    if (!hasAlerts) badges = `<span class="dash-alert-badge green">✓ Todo en orden</span>`;

    let listHTML = '';
    if (hasAlerts) {
      const items = [];
      alerts.overdue.forEach(a => items.push({ icon: '⚠️', title: `Entrega vencida: ${a.project.nombre}`, desc: `Vencido hace ${a.days} día${a.days > 1 ? 's' : ''}`, projectId: a.project.id }));
      alerts.urgent7d.forEach(a => items.push({ icon: '📅', title: `Entrega próxima: ${a.project.nombre}`, desc: `Faltan ${a.days} día${a.days > 1 ? 's' : ''}`, projectId: a.project.id }));
      alerts.saturated.forEach(w => items.push({ icon: '🔥', title: `Saturado: ${w.fullName}`, desc: `${w.count}/${w.max} proyectos (${w.loadPercentage}%)` }));
      alerts.noTeam.forEach(p => items.push({ icon: '👤', title: `Sin equipo: ${p.nombre}`, desc: `Estado: ${DataStore.getStatusInfo(p.estado).label}`, projectId: p.id }));

      listHTML = `<div class="dash-alerts-list">${items.map(item => `
        <div class="dash-alert-item" ${item.projectId ? `onclick="DashboardView.editProjectFromDrilldown('${item.projectId}')"` : ''}>
          <span class="alert-icon">${item.icon}</span>
          <div class="alert-text">
            <div class="alert-title">${item.title}</div>
            <div class="alert-desc">${item.desc}</div>
          </div>
        </div>
      `).join('')}</div>`;
    }

    return `
      <div class="dash-alerts-banner ${bannerClass} animate-slide-up stagger-1">
        <div class="dash-alerts-header" id="dash-alerts-toggle">
          <div class="dash-alerts-header-left">
            <span class="dash-alerts-icon">${icon}</span>
            <div>
              <div class="dash-alerts-title">${title}</div>
              <div class="dash-alerts-subtitle">${subtitle}</div>
            </div>
          </div>
          <div class="dash-alerts-badges">${badges}</div>
          ${hasAlerts ? '<span class="dash-alerts-expand" id="dash-alerts-arrow">▼</span>' : ''}
        </div>
        <div class="dash-alerts-body" id="dash-alerts-body">
          ${listHTML}
        </div>
      </div>
    `;
  }

  function renderExecSummary(summary) {
    const plainText = summary.narrative.replace(/<[^>]*>/g, '');
    return `
      <div class="dash-exec-summary level-${summary.level} animate-slide-up stagger-2">
        <div class="dash-exec-header">
          <div class="dash-exec-header-left">
            <span class="dash-exec-level ${summary.level}">${summary.levelIcon} ${summary.levelLabel}</span>
            <span class="dash-exec-title">Resumen Ejecutivo</span>
          </div>
          <button class="dash-exec-copy-btn" onclick="DashboardView.copyExecSummary()" title="Copiar al portapapeles">
            📋 Copiar
          </button>
        </div>
        <div class="dash-exec-body" id="exec-summary-text">
          ${summary.narrative}
        </div>
        <div id="exec-summary-plain" style="display:none">${plainText}</div>
      </div>
    `;
  }

  function renderSemaphore(data) {
    return `
      <div class="dash-semaphore-grid animate-slide-up stagger-3">
        ${data.map(item => `
          <div class="dash-semaphore-card">
            <div class="dash-semaphore-dot ${item.color}"></div>
            <div class="dash-semaphore-info">
              <div class="dash-semaphore-label">${item.label}</div>
              <div class="dash-semaphore-value">${item.value}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderPipeline(data) {
    return `
      <div class="dash-pipeline">
        <div class="dash-pipeline-title">📊 Pipeline de Proyectos</div>
        <div class="dash-pipeline-flow">
          ${data.map(stage => `
            <div class="dash-pipeline-stage" onclick="ProjectsView.setFilter('${stage.id}'); App.navigateTo('projects');" title="Ver ${stage.label}">
              <div class="dash-pipeline-count" style="color: ${stage.color}">${stage.count}</div>
              <div class="dash-pipeline-label">${stage.label}</div>
              <div class="dash-pipeline-bar">
                <div class="dash-pipeline-bar-fill" style="width: ${stage.percent}%; background: ${stage.color};"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════
     RENDER FUNCTIONS — Dynamic DOM updates
     ════════════════════════════════════════════ */

  function renderTeamHeatmap() {
    const container = document.getElementById('team-heatmap-container');
    if (!container) return;

    const workloads = DataStore.getTeamWorkload();
    const sorted = workloads.filter(w => w.member.activo).sort((a, b) => b.loadPercentage - a.loadPercentage);

    const available = sorted.filter(w => w.loadLevel === 'green').length;
    const moderate = sorted.filter(w => w.loadLevel === 'yellow').length;
    const high = sorted.filter(w => w.loadLevel === 'orange').length;
    const saturated = sorted.filter(w => w.loadLevel === 'red').length;

    container.innerHTML = `
      <div class="dash-heatmap">
        <div class="dash-heatmap-summary">
          <span class="dash-heatmap-summary-item" style="background: var(--status-green-bg); color: var(--status-green);">🟢 ${available} Disponible${available !== 1 ? 's' : ''}</span>
          <span class="dash-heatmap-summary-item" style="background: var(--status-yellow-bg); color: var(--status-yellow);">🟡 ${moderate} Moderado${moderate !== 1 ? 's' : ''}</span>
          <span class="dash-heatmap-summary-item" style="background: var(--status-orange-bg); color: var(--status-orange);">🟠 ${high} Carga Alta</span>
          <span class="dash-heatmap-summary-item" style="background: var(--status-red-bg); color: var(--status-red);">🔴 ${saturated} Saturado${saturated !== 1 ? 's' : ''}</span>
        </div>
        ${sorted.map(w => `
          <div class="dash-heatmap-row">
            <div class="dash-heatmap-name" title="${w.fullName}">${w.fullName}</div>
            <div class="dash-heatmap-bar-container">
              <div class="dash-heatmap-bar-fill ${w.loadLevel}" style="width: ${Math.max(w.loadPercentage, 2)}%;"></div>
            </div>
            <div class="dash-heatmap-count ${w.loadLevel}">${w.count}/${w.max}</div>
            <div class="dash-heatmap-label">${w.loadLabel}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderUpcomingDeadlines() {
    const deadlines = DataStore.getUpcomingDeadlines(90);
    // Also add overdue projects
    const allProjects = DataStore.getProjects();
    const now = new Date();
    const overdue = allProjects.filter(p => {
      if (['produccion', 'cancelado', 'archivado'].includes(p.estado)) return false;
      if (!p.fechaEstimadaFin) return false;
      return new Date(p.fechaEstimadaFin + 'T12:00:00') < now;
    }).sort((a, b) => new Date(a.fechaEstimadaFin) - new Date(b.fechaEstimadaFin));

    const allDeadlines = [...overdue, ...deadlines];

    const container = document.getElementById('upcoming-deadlines-list');
    if (!container) return;

    if (allDeadlines.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px 20px;">
          <div class="empty-state-icon">📅</div>
          <h3>Sin entregas próximas</h3>
          <p>No hay proyectos con fechas de entrega en los próximos 90 días.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="dash-deadlines-table">
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Prioridad</th>
            <th>Fecha Est.</th>
            <th>Riesgo</th>
            <th>Avance</th>
            <th>Responsable</th>
          </tr>
        </thead>
        <tbody>
          ${allDeadlines.slice(0, 15).map(p => {
            const deadline = new Date(p.fechaEstimadaFin + 'T12:00:00');
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            const isOverdue = daysLeft < 0;
            const isUrgent = daysLeft >= 0 && daysLeft <= 7;
            const prioInfo = DataStore.getPriorityInfo(p.prioridad);

            let riskClass, riskLabel;
            if (isOverdue) { riskClass = 'overdue'; riskLabel = `⚠ ${Math.abs(daysLeft)}d atraso`; }
            else if (isUrgent) { riskClass = 'urgent'; riskLabel = `📅 ${daysLeft}d`; }
            else { riskClass = 'ontrack'; riskLabel = `✓ ${daysLeft}d`; }

            const responsableId = p.pm || p.liderTecnico || '';
            const responsable = responsableId ? DataStore.getTeamMemberName(responsableId) : '—';

            const progressColor = isOverdue ? 'var(--status-red)' : isUrgent ? 'var(--status-orange)' : 'var(--status-green)';

            return `
              <tr style="cursor: pointer;" onclick="DashboardView.editProjectFromDrilldown('${p.id}')">
                <td style="font-weight: 600; color: var(--text-primary); max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.nombre}">${p.nombre}</td>
                <td><span class="badge ${prioInfo.badgeClass}">${prioInfo.label}</span></td>
                <td style="white-space: nowrap;">${formatDate(p.fechaEstimadaFin)}</td>
                <td><span class="dash-deadline-risk ${riskClass}">${riskLabel}</span></td>
                <td>
                  <div class="dash-deadline-progress">
                    <div class="dash-deadline-progress-bar">
                      <div class="dash-deadline-progress-fill" style="width: ${p.porcentajeAvance || 0}%; background: ${progressColor};"></div>
                    </div>
                    <span class="dash-deadline-progress-text" style="color: ${progressColor};">${p.porcentajeAvance || 0}%</span>
                  </div>
                </td>
                <td style="font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${responsable}">${responsable}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderThroughputSection(throughput, atRisk) {
    const container = document.getElementById('throughput-container');
    if (!container) return;

    const ratioVal = parseFloat(throughput.ratio);
    let ratioColor = 'var(--status-green)';
    let ratioIcon = '✅';
    let ratioTrend = 'Equilibrado';
    if (ratioVal > 1.5) { ratioColor = 'var(--status-red)'; ratioIcon = '⚠️'; ratioTrend = 'Se acumula trabajo'; }
    else if (ratioVal > 1.1) { ratioColor = 'var(--status-orange)'; ratioIcon = '📊'; ratioTrend = 'Ligero incremento'; }
    else if (ratioVal < 0.7) { ratioIcon = '📉'; ratioTrend = 'Se reduce backlog'; }

    container.innerHTML = `
      <div class="dash-throughput-grid">
        <div class="dash-throughput-card">
          <div class="dash-throughput-card-icon">🚀</div>
          <div class="dash-throughput-card-value">${throughput.throughputPerMonth}</div>
          <div class="dash-throughput-card-label">Completados / mes</div>
          <div class="dash-throughput-card-trend" style="color: var(--status-green);">Promedio 3 meses</div>
        </div>
        <div class="dash-throughput-card">
          <div class="dash-throughput-card-icon">📥</div>
          <div class="dash-throughput-card-value">${throughput.ingressPerMonth}</div>
          <div class="dash-throughput-card-label">Ingresados / mes</div>
          <div class="dash-throughput-card-trend" style="color: var(--text-tertiary);">Promedio 3 meses</div>
        </div>
        <div class="dash-throughput-card">
          <div class="dash-throughput-card-icon">${ratioIcon}</div>
          <div class="dash-throughput-card-value" style="color: ${ratioColor};">${throughput.ratio}x</div>
          <div class="dash-throughput-card-label">Ratio Ingreso/Egreso</div>
          <div class="dash-throughput-card-trend" style="color: ${ratioColor};">${ratioTrend}</div>
        </div>
        <div class="dash-throughput-card">
          <div class="dash-throughput-card-icon">⚠️</div>
          <div class="dash-throughput-card-value" style="color: ${atRisk.length > 0 ? 'var(--status-red)' : 'var(--status-green)'};">${atRisk.length}</div>
          <div class="dash-throughput-card-label">En Riesgo de Atraso</div>
          <div class="dash-throughput-card-trend" style="color: ${atRisk.length > 0 ? 'var(--status-red)' : 'var(--status-green)'};">${atRisk.length > 0 ? 'Avance < esperado' : 'En buen ritmo'}</div>
        </div>
      </div>
      ${atRisk.length > 0 ? `
        <div style="margin-top: 14px;">
          <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.03em;">Proyectos con avance menor al esperado</div>
          ${atRisk.map(r => {
            const prioInfo = DataStore.getPriorityInfo(r.project.prioridad);
            return `
              <div class="dash-risk-project" onclick="DashboardView.editProjectFromDrilldown('${r.project.id}')">
                <div class="risk-gauge" style="background: var(--status-red-bg); color: var(--status-red);">
                  -${r.gap}%
                </div>
                <div class="risk-info">
                  <div class="risk-name">${r.project.nombre}</div>
                  <div class="risk-detail">Avance real: ${r.actualProgress}% · Esperado: ${r.expectedProgress}% · <span class="badge ${prioInfo.badgeClass}" style="font-size:0.6rem;">${prioInfo.label}</span></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    `;
  }

  /* ════════════════════════════════════════════
     CHARTS — Existing chart renderers
     ════════════════════════════════════════════ */

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

        if (p.fechaRealFin) {
          const endMonth = p.fechaRealFin.substring(0, 7);
          if (endMonth <= monthKey) return false;
        } else {
          if (['produccion', 'cancelado', 'archivado'].includes(p.estado)) {
            const estFin = p.fechaEstimadaFin;
            if (estFin) {
              const estFinMonth = estFin.substring(0, 7);
              if (estFinMonth <= monthKey) return false;
            } else {
              return false;
            }
          }
          
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

  /* ════════════════════════════════════════════
     UTILITY FUNCTIONS
     ════════════════════════════════════════════ */

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

  function copyExecSummary() {
    const el = document.getElementById('exec-summary-plain');
    if (!el) return;
    const text = el.textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.dash-exec-copy-btn');
        if (btn) {
          const original = btn.innerHTML;
          btn.innerHTML = '✅ Copiado';
          setTimeout(() => { btn.innerHTML = original; }, 2000);
        }
      });
    }
  }

  function destroy() {
    [statusChart, priorityChart, monthlyChart, difficultyChart].forEach(c => { if (c) c.destroy(); });
    statusChart = priorityChart = monthlyChart = difficultyChart = null;
  }

  return { render, destroy, closeMonthlyDrilldown, editProjectFromDrilldown, copyExecSummary };
})();
