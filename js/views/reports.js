/* ============================================
   REPORTS VIEW - Export & Reporting
   ============================================ */

const ReportsView = (() => {
  function render() {
    const container = document.getElementById('page-content');
    const projects = DataStore.getProjects();
    const team = DataStore.getTeam();

    container.innerHTML = `
      <div class="section-header">
        <div>
          <h2 class="section-title">Reportes y Exportación</h2>
          <p class="section-subtitle">Generar reportes para la Dirección y backup de datos</p>
        </div>
      </div>

      <!-- Report Cards -->
      <div class="kpi-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));">

        <!-- Executive Summary -->
        <div class="chart-card animate-slide-up stagger-1" style="cursor:pointer;" onclick="ReportsView.generateExecutiveReport()">
          <div style="text-align:center;padding:20px 0;">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(99,102,241,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 16px;">
              📊
            </div>
            <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Resumen Ejecutivo</h3>
            <p style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:16px;">
              Reporte completo para presentación al Director con KPIs, estado de proyectos y carga del equipo.
            </p>
            <button class="btn btn-primary btn-sm">
              <i data-lucide="file-text" style="width:14px;height:14px;"></i> Generar Reporte
            </button>
          </div>
        </div>

        <!-- Export JSON -->
        <div class="chart-card animate-slide-up stagger-2" style="cursor:pointer;" onclick="ReportsView.exportJSON()">
          <div style="text-align:center;padding:20px 0;">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 16px;">
              💾
            </div>
            <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Backup Completo (JSON)</h3>
            <p style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:16px;">
              Exportar todos los datos del sistema en formato JSON para backup o migración.
            </p>
            <button class="btn btn-secondary btn-sm">
              <i data-lucide="download" style="width:14px;height:14px;"></i> Descargar JSON
            </button>
          </div>
        </div>

        <!-- Import JSON -->
        ${AuthManager.hasRole('superadmin', 'admin') ? `
        <div class="chart-card animate-slide-up stagger-3" style="cursor:pointer;" onclick="document.getElementById('import-file-input').click()">
          <div style="text-align:center;padding:20px 0;">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(249,115,22,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 16px;">
              📥
            </div>
            <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Importar Datos (JSON)</h3>
            <p style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:16px;">
              Restaurar datos desde un archivo JSON exportado previamente.
            </p>
            <button class="btn btn-secondary btn-sm">
              <i data-lucide="upload" style="width:14px;height:14px;"></i> Seleccionar Archivo
            </button>
            <input type="file" id="import-file-input" accept=".json" style="display:none;" onchange="ReportsView.importJSON(event)">
          </div>
        </div>
        ` : ''}

        <!-- Print Dashboard -->
        <div class="chart-card animate-slide-up stagger-4" style="cursor:pointer;" onclick="ReportsView.printReport()">
          <div style="text-align:center;padding:20px 0;">
            <div style="width:64px;height:64px;border-radius:16px;background:rgba(168,85,247,0.1);display:flex;align-items:center;justify-content:center;font-size:1.5rem;margin:0 auto 16px;">
              🖨️
            </div>
            <h3 style="font-size:0.95rem;font-weight:600;color:var(--text-primary);margin-bottom:6px;">Imprimir Dashboard</h3>
            <p style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:16px;">
              Imprimir o guardar como PDF el estado actual del dashboard.
            </p>
            <button class="btn btn-secondary btn-sm">
              <i data-lucide="printer" style="width:14px;height:14px;"></i> Imprimir
            </button>
          </div>
        </div>
      </div>

      <!-- Current Stats Summary -->
      <div class="chart-card animate-fade-in" style="margin-top:24px;">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Resumen Actual del Sistema</div>
            <div class="chart-card-subtitle">Datos actualizados al ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:12px;">
          <div>
            <h4 style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:12px;">Proyectos por Estado</h4>
            ${DataStore.STATUSES.map(s => {
              const count = projects.filter(p => p.estado === s.id).length;
              const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
              return `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <span style="width:10px;height:10px;border-radius:3px;background:${s.color};flex-shrink:0;"></span>
                  <span style="flex:1;font-size:0.8rem;color:var(--text-secondary);">${s.label}</span>
                  <span style="font-size:0.8rem;font-weight:600;color:var(--text-primary);min-width:30px;text-align:right;">${count}</span>
                  <div style="width:80px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:${s.color};border-radius:3px;transition:width 0.5s;"></div>
                  </div>
                  <span style="font-size:0.7rem;color:var(--text-tertiary);min-width:32px;text-align:right;">${pct}%</span>
                </div>
              `;
            }).join('')}
          </div>
          <div>
            <h4 style="font-size:0.78rem;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:12px;">Equipo</h4>
            <div style="font-size:0.82rem;color:var(--text-secondary);line-height:2;">
              <div>Total miembros: <strong style="color:var(--text-primary);">${team.length}</strong></div>
              <div>Activos: <strong style="color:var(--status-green);">${team.filter(m => m.activo).length}</strong></div>
              <div>Inactivos: <strong style="color:var(--status-red);">${team.filter(m => !m.activo).length}</strong></div>
              <div>Proyectos totales: <strong style="color:var(--text-primary);">${projects.length}</strong></div>
              <div>En desarrollo activo: <strong style="color:var(--status-cyan);">${projects.filter(p => ['analisis', 'desarrollo', 'testing'].includes(p.estado)).length}</strong></div>
              <div>Completados: <strong style="color:var(--status-green);">${projects.filter(p => p.estado === 'produccion').length}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      ${AuthManager.hasRole('superadmin', 'admin') ? `
      <div class="chart-card animate-fade-in" style="margin-top:16px;">
        <div class="chart-card-header">
          <div>
            <div class="chart-card-title">Gestión de Datos</div>
            <div class="chart-card-subtitle">Administración del almacenamiento local</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="ReportsView.loadSampleData()">
            <i data-lucide="database" style="width:14px;height:14px;"></i> Recargar Datos de Ejemplo
          </button>
          <button class="btn btn-danger btn-sm" onclick="ReportsView.clearData()">
            <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Limpiar Todos los Datos
          </button>
        </div>
        <p style="font-size:0.72rem;color:var(--text-tertiary);margin-top:10px;">
          ⚠️ Los datos se almacenan localmente en el navegador. Recomendamos exportar un backup JSON periódicamente.
        </p>
      </div>
      ` : ''}
    `;

    if (window.lucide) lucide.createIcons();
  }

  /* ── Export JSON ── */
  async function exportJSON() {
    try {
      const data = DataStore.exportData();
      const jsonString = JSON.stringify(data, null, 2);
      const filename = `backup_div_sistemas_${new Date().toISOString().split('T')[0]}.json`;

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'Archivo JSON',
            accept: { 'application/json': ['.json'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        App.showToast('Backup JSON guardado correctamente', 'success');
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        App.showToast('Backup JSON descargado correctamente', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error al exportar JSON:', err);
        App.showToast('Error al guardar el backup', 'error');
      }
    }
  }

  /* ── Import JSON ── */
  function importJSON(event) {
    if (!AuthManager.hasRole('superadmin', 'admin')) {
      App.showToast('No tiene permisos para importar datos.', 'error');
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const success = DataStore.importData(e.target.result);
        if (success) {
          App.showToast('Datos importados correctamente', 'success');
          App.updateSidebarCounts();
          render();
        } else {
          App.showToast('Error al importar los datos', 'error');
        }
      } catch (err) {
        App.showToast('Archivo JSON inválido', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  /* ── Executive Report ── */
  function generateExecutiveReport() {
    const projects = DataStore.getProjects();
    const team = DataStore.getTeam();
    const workload = DataStore.getTeamWorkload();
    const now = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

    const byStatus = DataStore.getProjectsByStatus();
    const byPriority = DataStore.getProjectsByPriority();

    const activeProjects = projects.filter(p => ['analisis', 'desarrollo', 'testing'].includes(p.estado));
    const criticalProjects = projects.filter(p => p.prioridad === 'critica' && p.estado !== 'produccion' && p.estado !== 'cancelado');
    const saturatedMembers = workload.filter(w => w.loadLevel === 'red');

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Reporte Ejecutivo - División Sistemas</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
          h1 { font-size: 1.6rem; color: #1a1a2e; margin-bottom: 4px; }
          h2 { font-size: 1.1rem; color: #4f46e5; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e0e7ff; }
          h3 { font-size: 0.95rem; color: #1a1a2e; margin: 16px 0 8px; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #4f46e5; }
          .header p { color: #64748b; font-size: 0.85rem; }
          .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
          .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: center; }
          .kpi-val { font-size: 1.8rem; font-weight: 800; color: #4f46e5; }
          .kpi-label { font-size: 0.72rem; color: #64748b; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 0.8rem; }
          th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
          td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; }
          .b-green { background: #dcfce7; color: #166534; }
          .b-red { background: #fef2f2; color: #991b1b; }
          .b-orange { background: #fff7ed; color: #9a3412; }
          .b-yellow { background: #fefce8; color: #854d0e; }
          .b-blue { background: #eff6ff; color: #1e40af; }
          .b-purple { background: #faf5ff; color: #6b21a8; }
          .b-cyan { background: #ecfeff; color: #155e75; }
          .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 0.72rem; color: #94a3b8; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏛️ Reporte Ejecutivo — División Sistemas</h1>
          <p>Fecha de generación: ${now}</p>
        </div>

        <h2>📊 Indicadores Clave</h2>
        <div class="kpi-row">
          <div class="kpi"><div class="kpi-val">${projects.length}</div><div class="kpi-label">Total Proyectos</div></div>
          <div class="kpi"><div class="kpi-val">${activeProjects.length}</div><div class="kpi-label">En Desarrollo Activo</div></div>
          <div class="kpi"><div class="kpi-val">${byStatus.produccion || 0}</div><div class="kpi-label">En Producción</div></div>
          <div class="kpi"><div class="kpi-val">${team.filter(m => m.activo).length}</div><div class="kpi-label">Miembros Activos</div></div>
        </div>

        <h2>📋 Distribución por Estado</h2>
        <table>
          <tr><th>Estado</th><th>Cantidad</th><th>Porcentaje</th></tr>
          ${DataStore.STATUSES.map(s => {
            const count = byStatus[s.id] || 0;
            const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
            return `<tr><td>${s.label}</td><td>${count}</td><td>${pct}%</td></tr>`;
          }).join('')}
        </table>

        <h2>🚨 Proyectos Críticos</h2>
        ${criticalProjects.length > 0 ? `
          <table>
            <tr><th>Proyecto</th><th>Estado</th><th>Avance</th><th>Responsable</th><th>Entrega Est.</th></tr>
            ${criticalProjects.map(p => `
              <tr>
                <td><strong>${p.nombre}</strong></td>
                <td>${DataStore.getStatusInfo(p.estado).label}</td>
                <td>${p.porcentajeAvance}%</td>
                <td>${DataStore.getTeamMemberName(p.pm || p.liderTecnico)}</td>
                <td>${p.fechaEstimadaFin || '—'}</td>
              </tr>
            `).join('')}
          </table>
        ` : '<p style="color:#64748b;font-size:0.85rem;">No hay proyectos con prioridad crítica pendientes.</p>'}

        <h2>📋 Todos los Proyectos Activos</h2>
        <table>
          <tr><th>Proyecto</th><th>Expediente</th><th>Estado</th><th>Prioridad</th><th>Avance</th><th>Responsable</th></tr>
          ${activeProjects.map(p => `
            <tr>
              <td>${p.nombre}</td>
              <td style="font-family:monospace;font-size:0.72rem;">${p.expediente || '—'}</td>
              <td><span class="badge b-${p.estado === 'analisis' ? 'purple' : p.estado === 'desarrollo' ? 'cyan' : 'yellow'}">${DataStore.getStatusInfo(p.estado).label}</span></td>
              <td><span class="badge b-${p.prioridad === 'critica' ? 'red' : p.prioridad === 'alta' ? 'orange' : p.prioridad === 'media' ? 'yellow' : 'green'}">${DataStore.getPriorityInfo(p.prioridad).label}</span></td>
              <td>${p.porcentajeAvance}%</td>
              <td>${DataStore.getTeamMemberName(p.pm || p.liderTecnico)}</td>
            </tr>
          `).join('')}
        </table>

        <h2>👥 Carga del Equipo</h2>
        <table>
          <tr><th>Miembro</th><th>Rol</th><th>Proyectos</th><th>Estado</th></tr>
          ${workload.map(w => `
            <tr>
              <td>${w.fullName}</td>
              <td>${w.member.rol}${w.member.destino ? ` (${w.member.destino})` : ''}</td>
              <td>${w.count} / ${w.max}</td>
              <td><span class="badge b-${w.loadLevel === 'green' ? 'green' : w.loadLevel === 'yellow' ? 'yellow' : w.loadLevel === 'orange' ? 'orange' : 'red'}">${w.loadLabel}</span></td>
            </tr>
          `).join('')}
        </table>

        ${saturatedMembers.length > 0 ? `
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin-top:12px;">
            <strong style="color:#991b1b;">⚠️ Alerta de Saturación:</strong>
            <span style="color:#7f1d1d;">${saturatedMembers.map(w => w.fullName).join(', ')} ${saturatedMembers.length === 1 ? 'está saturado/a' : 'están saturados/as'}. Se recomienda no asignar más proyectos.</span>
          </div>
        ` : ''}

        <div class="footer">
          <p>División Sistemas — Sistema de Gestión de Proyectos — Generado automáticamente</p>
        </div>
      </body>
      </html>
    `;

    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(reportHtml);
    reportWindow.document.close();
    App.showToast('Reporte ejecutivo generado en nueva pestaña', 'success');
  }

  function printReport() {
    generateExecutiveReport();
  }

  function loadSampleData() {
    if (!AuthManager.hasRole('superadmin', 'admin')) {
      App.showToast('No tiene permisos para cargar datos de ejemplo.', 'error');
      return;
    }
    DataStore.clearAllData();
    DataStore.seedSampleData();
    App.showToast('Datos de ejemplo cargados', 'success');
    App.updateSidebarCounts();
    render();
  }

  function clearData() {
    if (!AuthManager.hasRole('superadmin', 'admin')) {
      App.showToast('No tiene permisos para eliminar datos.', 'error');
      return;
    }
    if (confirm('¿Estás seguro? Se eliminarán TODOS los datos del sistema. Esta acción no se puede deshacer.')) {
      DataStore.clearAllData();
      App.showToast('Todos los datos fueron eliminados', 'warning');
      App.updateSidebarCounts();
      render();
    }
  }

  return {
    render,
    exportJSON,
    importJSON,
    generateExecutiveReport,
    printReport,
    loadSampleData,
    clearData
  };
})();
