/* ============================================
   APPLICATION CORE - Router + Global State
   ============================================ */

const App = (() => {
  let currentView = 'dashboard';
  
  const views = {
    dashboard: DashboardView,
    projects: ProjectsView,
    kanban: KanbanView,
    team: TeamView,
    reports: ReportsView,
    users: UsersView
  };

  async function init() {
    // 0. Verify authentication FIRST
    const isAuth = await AuthManager.init();
    if (!isAuth) {
      window.location.href = 'login.html';
      return;
    }

    // Check if user needs to change password
    const user = AuthManager.getUser();
    if (user && user.debeCambiarPassword) {
      window.location.href = 'login.html';
      return;
    }

    // 1. Update sidebar with user info
    updateSidebarUser();

    // 2. Initialize Cache from Oracle Database (handles auto-migration if needed)
    try {
      await DataStore.initializeCache();
    } catch (e) {
      console.error("Error al conectar con la base de datos:", e);
    }

    // 3. Auto-archive old production projects
    DataStore.autoArchiveOldProductionProjects();

    // 4. Setup Routing via Hash Change
    window.addEventListener('hashchange', handleRouting);
    
    // 5. Initial Routing
    handleRouting();

    // 6. Setup Global Search Input
    setupGlobalSearch();

    // 7. Initial Sidebar Counts
    updateSidebarCounts();

    // 8. Initialize Notifications Engine
    NotificationsEngine.init();
  }

  /**
   * Update sidebar to show current authenticated user info and admin nav.
   */
  function updateSidebarUser() {
    const user = AuthManager.getUser();
    if (!user) return;

    // Avatar initials
    const avatar = document.getElementById('sidebar-user-avatar');
    if (avatar) {
      const name = user.nombreDisplay || user.dni;
      const parts = name.split(' ');
      avatar.textContent = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }

    // Display name
    const nameEl = document.getElementById('sidebar-user-name');
    if (nameEl) {
      nameEl.textContent = user.nombreDisplay || `DNI ${user.dni}`;
    }

    // Role badge
    const roleEl = document.getElementById('sidebar-user-role');
    if (roleEl) {
      roleEl.textContent = AuthManager.getRolLabel(user.rol);
      roleEl.className = `sidebar-role-badge ${AuthManager.getRolBadgeClass(user.rol)}`;
    }

    // Show admin section in sidebar if user can manage users
    if (AuthManager.canManageUsers()) {
      document.querySelectorAll('.sidebar-admin-section').forEach(el => {
        el.style.display = '';
      });
    }
  }

  function handleRouting() {
    const hash = window.location.hash.substring(1);
    
    // Prevent unauthorized access to users view
    if (hash === 'users' && !AuthManager.canManageUsers()) {
      navigateTo('dashboard', true);
      return;
    }

    const targetView = views[hash] ? hash : 'dashboard';
    navigateTo(targetView, false);
  }

  function navigateTo(viewId, updateHash = true) {
    // Call destroy on current view if defined
    if (views[currentView] && typeof views[currentView].destroy === 'function') {
      views[currentView].destroy();
    }

    currentView = viewId;

    if (updateHash) {
      window.location.hash = viewId;
    }

    // Update active class in sidebar navigation
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    const activeItem = document.getElementById(`nav-${viewId}`);
    if (activeItem) {
      activeItem.classList.add('active');
    }

    // Update breadcrumb and header title
    const breadcrumb = document.getElementById('header-breadcrumb');
    const headerTitle = document.getElementById('header-title');
    
    const viewMetadata = {
      dashboard: { title: 'Dashboard Ejecutivo', path: 'División Sistemas / Dashboard' },
      projects: { title: 'Gestión de Proyectos', path: 'División Sistemas / Proyectos' },
      kanban: { title: 'Tablero Kanban', path: 'División Sistemas / Kanban' },
      team: { title: 'Equipo de Desarrollo', path: 'División Sistemas / Equipo' },
      reports: { title: 'Reportes y Exportación', path: 'División Sistemas / Reportes' },
      users: { title: 'Gestión de Usuarios', path: 'División Sistemas / Administración / Usuarios' }
    };

    if (breadcrumb && viewMetadata[viewId]) {
      breadcrumb.textContent = viewMetadata[viewId].path;
    }
    if (headerTitle && viewMetadata[viewId]) {
      headerTitle.textContent = viewMetadata[viewId].title;
    }

    // Show/hide search depending on view
    const searchContainer = document.getElementById('header-search-container');
    const searchInput = document.getElementById('global-search-input');
    
    if (searchContainer && searchInput) {
      // Clear search query on view switch
      searchInput.value = '';
      
      if (viewId === 'projects') {
        searchContainer.style.opacity = '0';
        searchContainer.style.pointerEvents = 'none';
      } else if (viewId === 'kanban' || viewId === 'team') {
        searchContainer.style.opacity = '1';
        searchContainer.style.pointerEvents = 'auto';
        searchInput.placeholder = viewId === 'kanban' ? 'Buscar en Kanban...' : 'Buscar miembro...';
      } else {
        searchContainer.style.opacity = '0';
        searchContainer.style.pointerEvents = 'none';
      }
    }

    // Render new view
    if (views[viewId]) {
      views[viewId].render();
    }

    // Scroll to top
    const pageContent = document.getElementById('page-content');
    if (pageContent) {
      pageContent.scrollTop = 0;
    }
  }

  function updateSidebarCounts() {
    const badge = document.getElementById('badge-projects-count');
    if (badge) {
      const activeProjects = DataStore.getProjects().filter(p => !['produccion', 'cancelado', 'archivado'].includes(p.estado));
      badge.textContent = activeProjects.length;
    }
    // Refresh notification badge
    if (typeof NotificationsEngine !== 'undefined') {
      NotificationsEngine.updateBadge();
    }
  }

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Choose emoji icon based on type
    let icon = '✔️';
    if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';
    else if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <span style="font-size: 1.1rem; flex-shrink: 0;">${icon}</span>
      <span class="toast-message">${message}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
    `;

    container.appendChild(toast);

    // Auto-remove animation
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => {
        toast.remove();
      }, 350);
    }, 3500);
  }

  /**
   * Show change password modal (triggered from sidebar).
   */
  function showChangePassword() {
    // If UsersView is loaded, use its modal
    if (typeof UsersView !== 'undefined' && UsersView.showSelfPasswordModal) {
      // Ensure users view modals exist in DOM
      if (!document.getElementById('self-pwd-modal-overlay')) {
        // Navigate to users temporarily to inject modals, then show modal
        const prevView = currentView;
        // Create the modal directly instead
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.id = 'self-pwd-modal-overlay-global';
        overlay.innerHTML = `
          <div class="modal-content" style="max-width: 440px;">
            <div class="modal-header">
              <h3>🔐 Cambiar Mi Contraseña</h3>
              <button class="modal-close" onclick="document.getElementById('self-pwd-modal-overlay-global').remove()">&times;</button>
            </div>
            <div class="modal-body">
              <form id="self-pwd-form-global">
                <div class="form-group">
                  <label class="form-label">Contraseña Actual</label>
                  <input type="password" class="form-input" id="self-pwd-current-g" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Nueva Contraseña</label>
                  <input type="password" class="form-input" id="self-pwd-new-g" required minlength="6">
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmar Nueva Contraseña</label>
                  <input type="password" class="form-input" id="self-pwd-confirm-g" required minlength="6">
                </div>
                <div class="form-actions" style="margin-top: 1.25rem;">
                  <button type="button" class="btn btn-outline" onclick="document.getElementById('self-pwd-modal-overlay-global').remove()">Cancelar</button>
                  <button type="submit" class="btn btn-primary">Cambiar Contraseña</button>
                </div>
              </form>
            </div>
          </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('self-pwd-form-global').addEventListener('submit', async (e) => {
          e.preventDefault();
          const current = document.getElementById('self-pwd-current-g').value;
          const newPwd = document.getElementById('self-pwd-new-g').value;
          const confirmPwd = document.getElementById('self-pwd-confirm-g').value;

          if (newPwd !== confirmPwd) {
            showToast('Las contraseñas no coinciden.', 'error');
            return;
          }

          const result = await AuthManager.changePassword(current, newPwd);
          if (result.success) {
            showToast('Contraseña cambiada exitosamente.', 'success');
            overlay.remove();
          } else {
            showToast(result.error, 'error');
          }
        });
      } else {
        UsersView.showSelfPasswordModal();
      }
    }
  }

  function setupGlobalSearch() {
    const searchInput = document.getElementById('global-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      
      if (currentView === 'kanban') {
        // Filter cards in Kanban board
        const cards = document.querySelectorAll('.kanban-card');
        cards.forEach(card => {
          const title = card.querySelector('.kanban-card-title')?.textContent.toLowerCase() || '';
          const meta = card.querySelector('.kanban-card-meta')?.textContent.toLowerCase() || '';
          if (title.includes(query) || meta.includes(query)) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      } else if (currentView === 'team') {
        // Filter cards in team workload or rows in team member list
        const cards = document.querySelectorAll('.team-card');
        if (cards.length > 0) {
          cards.forEach(card => {
            const name = card.querySelector('h3')?.textContent.toLowerCase() || '';
            const role = card.querySelector('.team-card-info span')?.textContent.toLowerCase() || '';
            if (name.includes(query) || role.includes(query)) {
              card.style.display = '';
            } else {
              card.style.display = 'none';
            }
          });
        }
        
        const rows = document.querySelectorAll('.data-table tbody tr');
        if (rows.length > 0) {
          rows.forEach(row => {
            const content = row.textContent.toLowerCase();
            if (content.includes(query)) {
              row.style.display = '';
            } else {
              row.style.display = 'none';
            }
          });
        }
      }
    });
  }

  return {
    init,
    navigateTo,
    updateSidebarCounts,
    showToast,
    showChangePassword
  };
})();

// Bootstrap app on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
