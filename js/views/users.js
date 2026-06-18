/* ============================================
   VIEW: Users Management (superadmin/admin only)
   ============================================ */

const UsersView = (() => {
  const API_BASE = '/api';
  let cachedUsers = [];

  async function render() {
    const container = document.getElementById('page-content');
    if (!container) return;

    container.innerHTML = `
      <div class="users-view">
        <!-- Toolbar -->
        <div class="view-toolbar">
          <div class="toolbar-left">
            <h3 style="color: var(--text-primary); font-size: 1.05rem; font-weight: 600;">
              Gestión de Usuarios del Sistema
            </h3>
            <span class="toolbar-subtitle" id="users-count-label">Cargando...</span>
          </div>
          <div class="toolbar-right">
            ${AuthManager.hasRole('superadmin', 'admin') ? `
              <button class="btn btn-primary" onclick="UsersView.showCreateModal()" id="btn-create-user">
                <span>+</span> Nuevo Usuario
              </button>
            ` : ''}
            ${AuthManager.hasRole('superadmin') ? `
              <button class="btn btn-outline" onclick="UsersView.showAuditLog()" id="btn-audit-log">
                📋 Audit Log
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Users Table -->
        <div class="card" style="margin-top: 1.25rem;">
          <div class="card-body" style="padding: 0;">
            <table class="data-table" id="users-table">
              <thead>
                <tr>
                  <th>DNI</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Vinculado a Equipo</th>
                  <th>Estado</th>
                  <th>Último Acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
                <tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando usuarios...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Create/Edit User Modal -->
      <div class="modal-overlay" id="user-modal-overlay">
        <div class="modal-content" id="user-modal" style="max-width: 520px;">
          <div class="modal-header">
            <h3 id="user-modal-title">Nuevo Usuario</h3>
            <button class="modal-close" onclick="UsersView.closeModal()">&times;</button>
          </div>
          <div class="modal-body" id="user-modal-body"></div>
        </div>
      </div>

      <!-- Audit Log Modal -->
      <div class="modal-overlay" id="audit-modal-overlay">
        <div class="modal-content" id="audit-modal" style="max-width: 800px;">
          <div class="modal-header">
            <h3>📋 Registro de Auditoría</h3>
            <button class="modal-close" onclick="UsersView.closeAuditModal()">&times;</button>
          </div>
          <div class="modal-body" id="audit-modal-body" style="max-height: 500px; overflow-y: auto;"></div>
        </div>
      </div>

      <!-- Change Password Modal (from sidebar) -->
      <div class="modal-overlay" id="self-pwd-modal-overlay">
        <div class="modal-content" style="max-width: 440px;">
          <div class="modal-header">
            <h3>🔐 Cambiar Mi Contraseña</h3>
            <button class="modal-close" onclick="UsersView.closeSelfPwdModal()">&times;</button>
          </div>
          <div class="modal-body">
            <form id="self-pwd-form">
              <div class="form-group">
                <label class="form-label">Contraseña Actual</label>
                <input type="password" class="form-input" id="self-pwd-current" required>
              </div>
              <div class="form-group">
                <label class="form-label">Nueva Contraseña</label>
                <input type="password" class="form-input" id="self-pwd-new" required minlength="6">
              </div>
              <div class="form-group">
                <label class="form-label">Confirmar Nueva Contraseña</label>
                <input type="password" class="form-input" id="self-pwd-confirm" required minlength="6">
              </div>
              <div class="form-actions" style="margin-top: 1.25rem;">
                <button type="button" class="btn btn-outline" onclick="UsersView.closeSelfPwdModal()">Cancelar</button>
                <button type="submit" class="btn btn-primary">Cambiar Contraseña</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    await loadUsers();
  }

  async function loadUsers() {
    try {
      const response = await AuthManager.authFetch(`${API_BASE}/users`);
      if (response.ok) {
        cachedUsers = await response.json();
        renderTable();
      }
    } catch (err) {
      console.error('Error loading users:', err);
      const tbody = document.getElementById('users-table-body');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #ef4444;">Error al cargar usuarios: ${err.message}</td></tr>`;
      }
    }
  }

  function renderTable() {
    const tbody = document.getElementById('users-table-body');
    const countLabel = document.getElementById('users-count-label');
    if (!tbody) return;

    if (countLabel) {
      countLabel.textContent = `${cachedUsers.length} usuario${cachedUsers.length !== 1 ? 's' : ''} registrado${cachedUsers.length !== 1 ? 's' : ''}`;
    }

    if (cachedUsers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = cachedUsers.map(user => {
      const rolBadge = getRolBadgeHtml(user.rol);
      const statusBadge = user.activo
        ? '<span class="badge badge-success">Activo</span>'
        : '<span class="badge badge-danger">Inactivo</span>';
      const lastLogin = user.ultimoLogin
        ? new Date(user.ultimoLogin).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '<span style="color: var(--text-muted);">Nunca</span>';

      const isSelf = AuthManager.getUser()?.id === user.id;
      const canEdit = AuthManager.hasRole('superadmin') || (AuthManager.hasRole('admin') && user.rol !== 'superadmin');

      return `
        <tr class="${!user.activo ? 'row-inactive' : ''}">
          <td><strong>${user.dni}</strong></td>
          <td>${user.nombreDisplay || '<span style="color: var(--text-muted);">Sin nombre</span>'}${isSelf ? ' <span style="color: var(--accent-blue); font-size: 0.75rem;">(Tú)</span>' : ''}</td>
          <td>${rolBadge}</td>
          <td>${user.equipoId ? '✅ Vinculado' : '<span style="color: var(--text-muted);">No vinculado</span>'}</td>
          <td>${statusBadge}</td>
          <td>${lastLogin}</td>
          <td>
            <div class="table-actions">
              ${canEdit ? `
                <button class="btn-icon" onclick="UsersView.showEditModal('${user.id}')" title="Editar">✏️</button>
                ${AuthManager.hasRole('superadmin') && !isSelf ? `
                  <button class="btn-icon" onclick="UsersView.resetPassword('${user.id}', '${user.dni}')" title="Resetear contraseña">🔑</button>
                  <button class="btn-icon btn-icon-danger" onclick="UsersView.toggleActive('${user.id}', ${user.activo})" title="${user.activo ? 'Desactivar' : 'Activar'}">
                    ${user.activo ? '🚫' : '✅'}
                  </button>
                ` : ''}
              ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">—</span>'}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function getRolBadgeHtml(rol) {
    const config = {
      superadmin: { label: 'Super Admin', cls: 'badge-superadmin', icon: '👑' },
      admin: { label: 'Admin', cls: 'badge-admin', icon: '🛡️' },
      carga: { label: 'Carga', cls: 'badge-carga', icon: '📝' },
      lectura: { label: 'Lectura', cls: 'badge-lectura', icon: '👁️' }
    };
    const c = config[rol] || config.lectura;
    return `<span class="badge ${c.cls}">${c.icon} ${c.label}</span>`;
  }

  function showCreateModal() {
    const title = document.getElementById('user-modal-title');
    const body = document.getElementById('user-modal-body');
    title.textContent = 'Nuevo Usuario';

    const teamMembers = typeof DataStore !== 'undefined' ? DataStore.getTeam() : [];

    body.innerHTML = `
      <form id="user-form" autocomplete="off">
        <div class="form-group">
          <label class="form-label">DNI <span style="color: #ef4444;">*</span></label>
          <input type="number" class="form-input" id="user-dni" placeholder="Ej: 35456789" required min="1000000" max="9999999999">
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña Temporal <span style="color: #ef4444;">*</span></label>
          <input type="password" class="form-input" id="user-password" placeholder="Mínimo 6 caracteres" required minlength="6">
          <small style="color: var(--text-muted); font-size: 0.75rem;">El usuario deberá cambiarla en su primer inicio de sesión.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Rol del Sistema <span style="color: #ef4444;">*</span></label>
          <select class="form-input" id="user-rol">
            <option value="lectura">👁️ Solo Lectura (Gerencia)</option>
            <option value="carga">📝 Carga de Datos (Desarrollador)</option>
            <option value="admin">🛡️ Administrador</option>
            ${AuthManager.hasRole('superadmin') ? '<option value="superadmin">👑 Super Administrador</option>' : ''}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vincular a Miembro de Equipo</label>
          <select class="form-input" id="user-equipo">
            <option value="">— Sin vincular —</option>
            ${teamMembers.filter(m => m.activo).map(m => {
              const rank = m.jerarquia ? `${m.jerarquia} ` : '';
              return `<option value="${m.id}">${rank}${m.nombre} ${m.apellido}</option>`;
            }).join('')}
          </select>
          <small style="color: var(--text-muted); font-size: 0.75rem;">Vincular permite que el sistema identifique al usuario como miembro del equipo para permisos de proyecto.</small>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre para Mostrar</label>
          <input type="text" class="form-input" id="user-nombre" placeholder="Opcional si está vinculado a equipo">
        </div>
        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-outline" onclick="UsersView.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Crear Usuario</button>
        </div>
      </form>
    `;

    document.getElementById('user-form').addEventListener('submit', handleCreate);
    document.getElementById('user-modal-overlay').classList.add('active');
  }

  function showEditModal(userId) {
    const user = cachedUsers.find(u => u.id === userId);
    if (!user) return;

    const title = document.getElementById('user-modal-title');
    const body = document.getElementById('user-modal-body');
    title.textContent = `Editar Usuario — DNI ${user.dni}`;

    const teamMembers = typeof DataStore !== 'undefined' ? DataStore.getTeam() : [];

    body.innerHTML = `
      <form id="user-edit-form">
        <div class="form-group">
          <label class="form-label">DNI</label>
          <input type="text" class="form-input" value="${user.dni}" disabled style="opacity: 0.5;">
        </div>
        <div class="form-group">
          <label class="form-label">Rol del Sistema</label>
          <select class="form-input" id="edit-user-rol">
            <option value="lectura" ${user.rol === 'lectura' ? 'selected' : ''}>👁️ Solo Lectura</option>
            <option value="carga" ${user.rol === 'carga' ? 'selected' : ''}>📝 Carga de Datos</option>
            <option value="admin" ${user.rol === 'admin' ? 'selected' : ''}>🛡️ Administrador</option>
            ${AuthManager.hasRole('superadmin') ? `<option value="superadmin" ${user.rol === 'superadmin' ? 'selected' : ''}>👑 Super Administrador</option>` : ''}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vincular a Miembro de Equipo</label>
          <select class="form-input" id="edit-user-equipo">
            <option value="">— Sin vincular —</option>
            ${teamMembers.filter(m => m.activo).map(m => {
              const rank = m.jerarquia ? `${m.jerarquia} ` : '';
              return `<option value="${m.id}" ${user.equipoId === m.id ? 'selected' : ''}>${rank}${m.nombre} ${m.apellido}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Nombre para Mostrar</label>
          <input type="text" class="form-input" id="edit-user-nombre" value="${user.nombreDisplay || ''}">
        </div>
        <div class="form-actions" style="margin-top: 1.5rem;">
          <button type="button" class="btn btn-outline" onclick="UsersView.closeModal()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Guardar Cambios</button>
        </div>
      </form>
    `;

    document.getElementById('user-edit-form').addEventListener('submit', (e) => handleEdit(e, userId));
    document.getElementById('user-modal-overlay').classList.add('active');
  }

  async function handleCreate(e) {
    e.preventDefault();

    const data = {
      dni: document.getElementById('user-dni').value.trim(),
      password: document.getElementById('user-password').value,
      rol: document.getElementById('user-rol').value,
      equipoId: document.getElementById('user-equipo').value || null,
      nombreDisplay: document.getElementById('user-nombre').value.trim() || null
    };

    try {
      const response = await AuthManager.authFetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        closeModal();
        App.showToast(`Usuario creado exitosamente (DNI: ${data.dni})`, 'success');
        await loadUsers();
      } else {
        App.showToast(result.error || 'Error al crear usuario', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  async function handleEdit(e, userId) {
    e.preventDefault();

    const data = {
      rol: document.getElementById('edit-user-rol').value,
      equipoId: document.getElementById('edit-user-equipo').value || null,
      nombreDisplay: document.getElementById('edit-user-nombre').value.trim() || null
    };

    try {
      const response = await AuthManager.authFetch(`${API_BASE}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        closeModal();
        App.showToast('Usuario actualizado correctamente', 'success');
        await loadUsers();
      } else {
        App.showToast(result.error || 'Error al actualizar usuario', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  async function resetPassword(userId, userDni) {
    const newPassword = prompt(`Ingrese la nueva contraseña temporal para DNI ${userDni} (mínimo 6 caracteres):`);
    if (!newPassword) return;

    if (newPassword.length < 6) {
      App.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    try {
      const response = await AuthManager.authFetch(`${API_BASE}/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });

      const result = await response.json();

      if (response.ok) {
        App.showToast(`Contraseña reseteada para DNI ${userDni}. El usuario deberá cambiarla al iniciar sesión.`, 'success');
      } else {
        App.showToast(result.error || 'Error al resetear contraseña', 'error');
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  async function toggleActive(userId, currentActive) {
    const user = cachedUsers.find(u => u.id === userId);
    if (!user) return;

    const action = currentActive ? 'desactivar' : 'activar';
    if (!confirm(`¿Está seguro que desea ${action} al usuario DNI ${user.dni}?`)) return;

    try {
      if (currentActive) {
        // Deactivate via DELETE (soft delete)
        const response = await AuthManager.authFetch(`${API_BASE}/users/${userId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          App.showToast(`Usuario DNI ${user.dni} desactivado.`, 'success');
          await loadUsers();
        }
      } else {
        // Reactivate via PUT
        const response = await AuthManager.authFetch(`${API_BASE}/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: true })
        });
        if (response.ok) {
          App.showToast(`Usuario DNI ${user.dni} reactivado.`, 'success');
          await loadUsers();
        }
      }
    } catch (err) {
      App.showToast(err.message, 'error');
    }
  }

  async function showAuditLog() {
    const body = document.getElementById('audit-modal-body');
    body.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">Cargando registros...</div>';
    document.getElementById('audit-modal-overlay').classList.add('active');

    try {
      const response = await AuthManager.authFetch(`${API_BASE}/users/audit-log?limit=200`);
      if (response.ok) {
        const logs = await response.json();

        if (logs.length === 0) {
          body.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay registros de auditoría.</div>';
          return;
        }

        body.innerHTML = `
          <table class="data-table" style="font-size: 0.8125rem;">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(log => `
                <tr>
                  <td style="white-space: nowrap;">${new Date(log.timestamp).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                  <td><span class="badge ${getAuditBadgeClass(log.accion)}">${log.accion}</span></td>
                  <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${log.detalle || '—'}</td>
                  <td style="font-family: monospace; font-size: 0.75rem;">${log.ipAddress || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (err) {
      body.innerHTML = `<div style="text-align: center; padding: 2rem; color: #ef4444;">Error: ${err.message}</div>`;
    }
  }

  function getAuditBadgeClass(action) {
    if (action.includes('login') && !action.includes('failed')) return 'badge-success';
    if (action.includes('failed') || action.includes('locked')) return 'badge-danger';
    if (action.includes('create') || action.includes('reset')) return 'badge-info';
    if (action.includes('update') || action.includes('change')) return 'badge-warning';
    if (action.includes('deactivate') || action.includes('delete')) return 'badge-danger';
    return 'badge-default';
  }

  function closeModal() {
    document.getElementById('user-modal-overlay')?.classList.remove('active');
  }

  function closeAuditModal() {
    document.getElementById('audit-modal-overlay')?.classList.remove('active');
  }

  // Self password change (accessible from sidebar)
  function showSelfPasswordModal() {
    document.getElementById('self-pwd-modal-overlay')?.classList.add('active');

    const form = document.getElementById('self-pwd-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const current = document.getElementById('self-pwd-current').value;
        const newPwd = document.getElementById('self-pwd-new').value;
        const confirm = document.getElementById('self-pwd-confirm').value;

        if (newPwd !== confirm) {
          App.showToast('Las contraseñas no coinciden.', 'error');
          return;
        }

        const result = await AuthManager.changePassword(current, newPwd);
        if (result.success) {
          App.showToast('Contraseña cambiada exitosamente.', 'success');
          closeSelfPwdModal();
        } else {
          App.showToast(result.error, 'error');
        }
      };
    }
  }

  function closeSelfPwdModal() {
    document.getElementById('self-pwd-modal-overlay')?.classList.remove('active');
  }

  function destroy() {
    cachedUsers = [];
  }

  return {
    render,
    destroy,
    showCreateModal,
    showEditModal,
    closeModal,
    closeAuditModal,
    showAuditLog,
    resetPassword,
    toggleActive,
    showSelfPasswordModal,
    closeSelfPwdModal
  };
})();
