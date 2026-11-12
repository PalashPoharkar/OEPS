import { api } from "./apiClient";

export const fetchAllUsers = async (page = 1, limit = 20, search = "") => {
  const res = await api.get("/api/admin/users", { params: { page, limit, search } });
  return res.data;
};

export const updateUserRole = async (id, role) => {
  const res = await api.patch(`/api/admin/users/${id}/role`, { role });
  return res.data;
};

export const deleteUserAccount = async (id) => {
  const res = await api.delete(`/api/admin/users/${id}`);
  return res.data;
};
