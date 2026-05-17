import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Release, ReleaseCreate, ReleaseUpdate } from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const releaseKeys = {
  all: ["releases"] as const,
  lists: (filters?: { status?: string }) =>
    [...releaseKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...releaseKeys.all, "detail", id] as const,
};

// ---------------------------------------------------------------------------
// GET /releases/
// ---------------------------------------------------------------------------
export function useReleases(filters?: { status?: string }) {
  return useQuery<Release[]>({
    queryKey: releaseKeys.lists(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status) params.status = filters.status;
      const { data } = await api.get<Release[]>("/releases/", { params });
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// GET /releases/{id}
// ---------------------------------------------------------------------------
export function useRelease(id: string) {
  return useQuery<Release>({
    queryKey: releaseKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Release>(`/releases/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// POST /releases/
// ---------------------------------------------------------------------------
export function useCreateRelease() {
  const queryClient = useQueryClient();

  return useMutation<Release, Error, ReleaseCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Release>("/releases/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /releases/{id}
// ---------------------------------------------------------------------------
export function useUpdateRelease() {
  const queryClient = useQueryClient();

  return useMutation<Release, Error, { id: string; payload: ReleaseUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<Release>(`/releases/${id}`, payload);
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.all });
      queryClient.invalidateQueries({ queryKey: releaseKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /releases/{id}
// ---------------------------------------------------------------------------
export function useDeleteRelease() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/releases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.all });
    },
  });
}
