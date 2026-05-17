import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Department } from "@/types";

const KEYS = {
  all: ["departments"] as const,
  list: () => [...KEYS.all, "list"] as const,
};

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: KEYS.list(),
    queryFn: async () => {
      const { data } = await api.get<Department[]>("/departments/");
      return data;
    },
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation<Department, Error, { name: string; description?: string | null }>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Department>("/departments/", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation<Department, Error, { id: string; name?: string; description?: string | null }>({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch<Department>(`/departments/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/departments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
