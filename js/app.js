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
    reports: ReportsView
  };

  function init() {
    // 1. Seed initial mock data if localStorage is empty
    DataStore.seedSampleData();

    // 2. Auto-archive old production projects
    DataStore.autoArchiveOldProductionProjects();

    // 3. Setup Routing via Hash Change
    window.addEventListener('hashchange', handleRouting);
    
    // 3. Initial Routing
    handleRouting();

    // 4. Setup Global Search Input
    setupGlobalSearch();

    // 5. Initial Sidebar Counts
    updateSidebarCounts();

    // 6. Initialize Notifications Engine
    NotificationsEngine.init();
  }

  function handleRouting() {
    const hash = window.location.hash.substring(1);
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
      reports: { title: 'Reportes y Exportación', path: 'División Sistemas / Reportes' }
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
        // ProjectsView has its own toolbar search, hide global header search to avoid confusion
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
    showToast
  };
})();

// Bootstrap app on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
