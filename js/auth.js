/* ============================================
   AUTH MANAGER - Frontend Authentication Module
   ============================================ */

const AuthManager = (() => {
  const API_BASE = '/api';
  const SESSION_KEY = 'div_sistemas_session';

  let currentUser = null;
  let authToken = null;

  /**
   * Initialize auth state from sessionStorage.
   * Returns true if a valid session exists.
   */
  async function init() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return false;

    try {
      const session = JSON.parse(stored);
      authToken = session.token;
      currentUser = session.user;

      // Validate session with backend
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        currentUser = await response.json();
        // Update stored session with fresh user data
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: authToken, user: currentUser }));
        return true;
      } else {
        // Token invalid/expired
        clearSession();
        return false;
      }
    } catch (err) {
      console.error('Error validating session:', err);
      clearSession();
      return false;
    }
  }

  /**
   * Login with DNI and password.
   * Returns { success: boolean, error?: string, user?: object }
   */
  async function login(dni, password) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, password })
      });

      const data = await response.json();

      if (response.ok) {
        authToken = data.token;
        currentUser = data.user;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: authToken, user: currentUser }));
        return { success: true, user: currentUser };
      } else {
        return { success: false, error: data.error || 'Error de autenticación.' };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: 'Error de conexión con el servidor.' };
    }
  }

  /**
   * Logout - clear session and redirect to login.
   */
  async function logout() {
    try {
      if (authToken) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      }
    } catch (err) {
      // Ignore errors on logout
    }
    clearSession();
    window.location.href = 'login.html';
  }

  /**
   * Change password for current user.
   */
  async function changePassword(currentPassword, newPassword) {
    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        // Update stored session - password changed flag
        if (currentUser) {
          currentUser.debeCambiarPassword = false;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: authToken, user: currentUser }));
        }
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error || 'Error al cambiar contraseña.' };
      }
    } catch (err) {
      return { success: false, error: 'Error de conexión con el servidor.' };
    }
  }

  function clearSession() {
    authToken = null;
    currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Get the current JWT token.
   */
  function getToken() {
    return authToken;
  }

  /**
   * Get the current authenticated user data.
   */
  function getUser() {
    return currentUser;
  }

  /**
   * Check if user is authenticated.
   */
  function isAuthenticated() {
    return !!authToken && !!currentUser;
  }

  /**
   * Check if current user has any of the specified roles.
   */
  function hasRole(...roles) {
    if (!currentUser) return false;
    return roles.includes(currentUser.rol);
  }

  /**
   * Check if current user can edit a specific project.
   * superadmin/admin can edit any project.
   * carga can edit only assigned projects.
   * lectura cannot edit anything.
   */
  function canEditProject(project) {
    if (!currentUser) return false;
    if (currentUser.rol === 'superadmin' || currentUser.rol === 'admin') return true;
    if (currentUser.rol === 'lectura') return false;

    // carga role - check assignment
    if (currentUser.rol === 'carga' && currentUser.equipoId && project) {
      const eqId = currentUser.equipoId;
      return (
        project.pm === eqId ||
        project.liderTecnico === eqId ||
        project.scrumMaster === eqId ||
        project.productOwner === eqId ||
        (project.desarrolladores && project.desarrolladores.includes(eqId))
      );
    }

    return false;
  }

  /**
   * Check if user can write (create/edit/delete) in general.
   */
  function canWrite() {
    return hasRole('superadmin', 'admin', 'carga');
  }

  /**
   * Check if user can manage team members.
   */
  function canManageTeam() {
    return hasRole('superadmin', 'admin');
  }

  /**
   * Check if user can manage users.
   */
  function canManageUsers() {
    return hasRole('superadmin', 'admin');
  }

  /**
   * Get role display label in Spanish.
   */
  function getRolLabel(rol) {
    const labels = {
      'superadmin': 'Super Administrador',
      'admin': 'Administrador',
      'carga': 'Carga de Datos',
      'lectura': 'Solo Lectura'
    };
    return labels[rol] || rol;
  }

  /**
   * Get role badge CSS class.
   */
  function getRolBadgeClass(rol) {
    const classes = {
      'superadmin': 'role-badge-superadmin',
      'admin': 'role-badge-admin',
      'carga': 'role-badge-carga',
      'lectura': 'role-badge-lectura'
    };
    return classes[rol] || 'role-badge-lectura';
  }

  /**
   * Wrapper around fetch that automatically adds auth header and handles 401/403.
   */
  async function authFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, options);

    if (response.status === 401) {
      // Session expired
      clearSession();
      window.location.href = 'login.html';
      throw new Error('Sesión expirada');
    }

    if (response.status === 403) {
      // Permission denied - don't redirect, just throw
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'No tiene permisos para esta acción.');
    }

    return response;
  }

  return {
    init,
    login,
    logout,
    changePassword,
    getToken,
    getUser,
    isAuthenticated,
    hasRole,
    canEditProject,
    canWrite,
    canManageTeam,
    canManageUsers,
    getRolLabel,
    getRolBadgeClass,
    authFetch
  };
})();
