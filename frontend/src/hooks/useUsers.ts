import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { User, UserRole } from "@/types";

const KEYS = {
  all: ["users"] as const,
  list: (params?: object) => [...KEYS.all, "list", params ?? {}] as const,
};

export function useUsers(sortBy: string = "name", activeOnly = true) {
  return useQuery<User[]>({
    queryKey: KEYS.list({ sortBy, activeOnly }),
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users/", {
        params: { sort_by: sortBy, active_only: activeOnly },
      });
      return data;
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation<User, Error, { id: string; role: UserRole }>({
    mutationFn: async ({ id, role }) => {
      const { data } = await api.patch<User>(`/users/${id}/role`, { role });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation<User, Error, { id: string; department?: string; display_name?: string }>({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch<User>(`/users/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation<User, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.patch<User>(`/users/${id}/toggle-active`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.all }),
  });
}

export function useCurrentUser() {
  return useQuery<User>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await api.get<User>("/users/me");
      return data;
    },
  });
}

export function useUpdateTheme() {
  const qc = useQueryClient();
  return useMutation<User, Error, { id: string; theme: "light" | "dark" }>({
    mutationFn: async ({ id, theme }) => {
      const { data } = await api.patch<User>(`/users/${id}`, { theme });
      return data;
    },
    onMutate: async ({ theme }) => {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(["currentUser"], data);
      qc.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

