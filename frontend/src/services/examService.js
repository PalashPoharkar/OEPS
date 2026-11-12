import { api } from "./apiclient";

export const createExam = async (payload) => {
  return await api.post("/api/exams", payload);
};

export const fetchMyExams = async (teacherId) => {
  const params = teacherId ? { teacher_id: teacherId } : {};
  const res = await api.get("/api/exams/mine", { params });
  return res.data;
};

export const publishExam = async (id, is_published) => {
  return await api.patch(`/api/exams/${id}/publish`, { is_published });
};

export const deleteExam = async (id) => {
  return await api.delete(`/api/exams/${id}`);
};

export const fetchPublishedExams = async () => {
  const res = await api.get("/api/exams/published");
  return res.data;
};

export const fetchExamResultsForExport = async (examId) => {
  const res = await api.get(`/api/exams/${examId}/export-results`);
  return res.data;
};
