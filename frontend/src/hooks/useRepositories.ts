import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Repository } from "@/types";

const KEYS = {
  all: ["repositories"] as const,
  list: () => [...KEYS.all, "list"] as const,
};

export function useRepositories() {
  return useQuery<Repository[]>({
    queryKey: KEYS.list(),
    queryFn: async () => {
      const { data } = await api.get<Repository[]>("/repositories/");
      return data;
    },
  });
}

export function useCreateRepository() {
  const qc = useQueryClient();
  return useMutation<
    Repository,
    Error,
    { name: string; github_repo: string; dev_branch?: string; qa_branch?: string; main_branch?: string }
  >({
    mutationFn: async (payload) => {
      const { data } = await api.post<Repository>("/repositories/", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateRepository() {
  const qc = useQueryClient();
  return useMutation<
    Repository,
    Error,
    { id: string; name?: string; github_repo?: string; dev_branch?: string; qa_branch?: string; main_branch?: string }
  >({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch<Repository>(`/repositories/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useDeleteRepository() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/repositories/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      qc.invalidateQueries({ queryKey: ["releases"] });
    },
  });
}
