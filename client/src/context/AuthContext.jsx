import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, loginUser, registerUser } from '../services/api';

// =============================================================================
// Auth Context
// =============================================================================
// Why React Context for auth: Auth state (user, token, isAuthenticated) is
// needed by many components at different levels of the tree — NavBar, route
// guards, profile pages, API calls. Prop-drilling this through every
// intermediate component would be messy and fragile. Context provides a
// single source of truth accessible from any depth without prop chains.
// =============================================================================
const AuthContext = createContext(null);

/**
 * AuthProvider wraps the app and manages authentication state.
 * It hydrates from localStorage on mount, verifies the token with the
 * backend, and exposes login/register/logout functions to all children.
 */
export function AuthProvider({ children }) {
  // Why separate user and token state instead of combining into one object:
  // They have different lifecycles — token can be set immediately from
  // localStorage while user requires an async API call to verify. Keeping
  // them separate avoids awkward partial-object states.
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Why isLoading starts as true: On first render, we don't know yet if
  // there's a valid token in localStorage. If we default to false, the
  // PrivateRoute guard would immediately redirect to /login before the
  // localStorage check completes, causing a flash of the login page for
  // users who are already logged in.
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  // Why !!token instead of !!token && !!user: A user can be momentarily
  // null while we verify the token on mount. Using just token avoids
  // a brief "not authenticated" flash during the verification window.
  // The PrivateRoute guard also checks isLoading, so this is safe.
  const isAuthenticated = !!token;

  // ── Hydrate auth state from localStorage on mount ──────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('mockmate_token');

      if (!storedToken) {
        // No token in storage — clean up any orphaned user data and stop
        localStorage.removeItem('mockmate_user');
        setIsLoading(false);
        return;
      }

      // Set token immediately so the Axios interceptor can use it for
      // the getCurrentUser() verification call below
      setToken(storedToken);

      try {
        // Verify the stored token is still valid by calling the /me endpoint.
        // Why verify instead of just trusting localStorage: The token may
        // have expired or been revoked server-side. Without verification,
        // a user with an expired token would see the dashboard briefly
        // before every API call fails with 401.
        const response = await getCurrentUser();
        const verifiedUser = response.data.user || response.data;
        setUser(verifiedUser);
        // Update stored user data in case it changed server-side
        localStorage.setItem('mockmate_user', JSON.stringify(verifiedUser));
      } catch {
        // Token is invalid or expired — clear everything so the user
        // is redirected to login by the route guards
        localStorage.removeItem('mockmate_token');
        localStorage.removeItem('mockmate_user');
        setToken(null);
        setUser(null);
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  /**
   * Log in with email and password. On success, stores auth data in both
   * React state and localStorage for persistence across page reloads.
   * On failure, throws the error so the calling component can display it.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The response data containing token and user
   * @throws {Error} If login fails (invalid credentials, network error, etc.)
   */
  const login = async (email, password) => {
    // Why we don't try/catch here: The calling component (LoginPage) needs
    // to catch the error to display it in the UI. If we caught it here,
    // the component would have no way to know the login failed.
    const response = await loginUser({ email, password });
    const { token: newToken, user: newUser } = response.data;

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('mockmate_token', newToken);
    localStorage.setItem('mockmate_user', JSON.stringify(newUser));

    return response.data;
  };

  /**
   * Register a new account. In MockMate, registration immediately logs the
   * user in (the server returns a token from the register endpoint), so we
   * store auth data the same way as login.
   *
   * @param {string} name
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The response data containing token and user
   * @throws {Error} If registration fails
   */
  const register = async (name, email, password) => {
    const response = await registerUser({ name, email, password });
    const { token: newToken, user: newUser } = response.data;

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('mockmate_token', newToken);
    localStorage.setItem('mockmate_user', JSON.stringify(newUser));

    return response.data;
  };

  /**
   * Log the user out by clearing all auth state.
   *
   * Why no API call: JWT is stateless — the server doesn't track active
   * sessions or maintain a token allowlist. "Logging out" simply means
   * discarding the token on the client side. The next time the user tries
   * to access a protected route, they won't have a token and will be
   * redirected to login. This is simpler and more reliable than a server
   * round-trip that could fail due to network issues.
   */
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('mockmate_token');
    localStorage.removeItem('mockmate_user');
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// =============================================================================
// Custom Hook: useAuth
// =============================================================================
// Why a custom hook instead of having components import useContext + AuthContext:
// 1. Less boilerplate — `useAuth()` vs `useContext(AuthContext)` in every file
// 2. Built-in safety — throws a clear error if used outside AuthProvider,
//    making misconfiguration obvious during development instead of causing
//    cryptic "cannot read property of null" errors at runtime
// 3. Encapsulation — components don't need to know about AuthContext at all,
//    they just call useAuth(). If we ever swap Context for Zustand or Redux,
//    only this hook changes.
// =============================================================================
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error(
      'useAuth() must be used within an <AuthProvider>. ' +
      'Wrap your app in <AuthProvider> in main.jsx.',
    );
  }
  return context;
}
