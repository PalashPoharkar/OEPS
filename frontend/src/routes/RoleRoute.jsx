import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/authContext";

export default function RoleRoute({ allowedRoles, children }) {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles.includes(user.role)) return children;

  const redirectTo =
    user.role === "admin"
      ? "/admin"
      : user.role === "teacher"
      ? "/teacher"
      : "/student";

  return <Navigate to={redirectTo} replace />;
}
