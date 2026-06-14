import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "../api/client.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "familyGiftToken";

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function getApiError(error, fallback = "Something went wrong. Please try again.") {
  return error?.response?.data?.detail || error?.message || fallback;
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const hydrateUser = useCallback(async (token) => {
    if (!token) {
      setCurrentUser(null);
      return null;
    }

    try {
      const meResponse = await apiClient.get("/users/me");
      setCurrentUser(meResponse.data);
      return meResponse.data;
    } catch (error) {
      const status = error?.response?.status;
      if (status && ![404, 405, 422].includes(status)) {
        throw error;
      }
    }

    const payload = decodeJwtPayload(token);
    const userId = payload?.sub;

    if (!userId) {
      throw new Error("Unable to read the user id from the access token.");
    }

    const response = await apiClient.get(`/users/${userId}`);
    setCurrentUser(response.data);
    return response.data;
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        if (isMounted) {
          setInitializing(false);
        }
        return;
      }

      try {
        const user = await hydrateUser(token);
        if (isMounted) {
          setCurrentUser(user);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        if (isMounted) {
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [hydrateUser]);

  const login = useCallback(
    async (credentials) => {
      try {
        const response = await apiClient.post("/auth/login", credentials);
        const token = response.data.access_token;
        localStorage.setItem(TOKEN_KEY, token);
        const user = await hydrateUser(token);
        return user;
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        setCurrentUser(null);
        throw new Error(getApiError(error, "Login failed."));
      }
    },
    [hydrateUser]
  );

  const register = useCallback(async (payload) => {
    try {
      const response = await apiClient.post("/auth/register", payload);
      return response.data;
    } catch (error) {
      throw new Error(getApiError(error, "Registration failed."));
    }
  }, []);

  const createFamily = useCallback(
    async (payload) => {
      try {
        const response = await apiClient.post("/auth/create-family", payload);
        const token = response.data.access_token;
        localStorage.setItem(TOKEN_KEY, token);
        const user = await hydrateUser(token);
        return { ...response.data, user };
      } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        setCurrentUser(null);
        throw new Error(getApiError(error, "Family creation failed."));
      }
    },
    [hydrateUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      createFamily,
      initializing,
      login,
      logout,
      register
    }),
    [currentUser, createFamily, initializing, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
