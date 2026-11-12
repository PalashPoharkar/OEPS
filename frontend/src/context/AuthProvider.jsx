import { useEffect, useState } from "react";
import { setAuthToken } from "../services/apiclient";
import { AuthContext } from "./authContext";

/* Read storage ONCE */
const getInitialAuth = () => {
  const raw = localStorage.getItem("auth");
  if (!raw) return { user: null, token: null };

  try {
    return JSON.parse(raw);
  } catch {
    return { user: null, token: null };
  }
};

export default function AuthProvider({ children }) {
  const initial = getInitialAuth();

  const [user, setUser] = useState(initial.user);
  const [token, setToken] = useState(initial.token);

  /* Attach token only when it changes */
  useEffect(() => {
    if (token) {
      setAuthToken(token);
    } else {
      setAuthToken(null);
    }
  }, [token]);

  const login = ({ token, user }) => {
    localStorage.setItem("auth", JSON.stringify({ token, user }));
    setToken(token);
    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem("auth");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields) => {
    const newUser = { ...user, ...updatedFields };
    setUser(newUser);
    localStorage.setItem("auth", JSON.stringify({ token, user: newUser }));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
