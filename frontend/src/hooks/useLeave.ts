import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Leave, LeaveCreate, LeaveUpdate, WhoIsOutEntry } from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const leaveKeys = {
  all: ["leaves"] as const,
  lists: () => [...leaveKeys.all, "list"] as const,
  detail: (id: string) => [...leaveKeys.all, "detail", id] as const,
  whoIsOut: () => [...leaveKeys.all, "who-is-out"] as const,
};

// ---------------------------------------------------------------------------
// GET /leave/
// ---------------------------------------------------------------------------
export function useLeaves() {
  return useQuery<Leave[]>({
    queryKey: leaveKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get<Leave[]>("/leave/");
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// GET /leave/{id}
// ---------------------------------------------------------------------------
export function useLeave(id: string) {
  return useQuery<Leave>({
    queryKey: leaveKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Leave>(`/leave/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// GET /leave/who-is-out
// ---------------------------------------------------------------------------
export function useWhoIsOut() {
  return useQuery<WhoIsOutEntry[]>({
    queryKey: leaveKeys.whoIsOut(),
    queryFn: async () => {
      const { data } = await api.get<WhoIsOutEntry[]>("/leave/who-is-out");
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// POST /leave/
// ---------------------------------------------------------------------------
export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation<Leave, Error, LeaveCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Leave>("/leave/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.whoIsOut() });
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /leave/{id}
// ---------------------------------------------------------------------------
export function useUpdateLeave() {
  const queryClient = useQueryClient();

  return useMutation<Leave, Error, { id: string; payload: LeaveUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<Leave>(`/leave/${id}`, payload);
      return data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leaveKeys.whoIsOut() });
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /leave/{id}
// ---------------------------------------------------------------------------
export function useDeleteLeave() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/leave/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.whoIsOut() });
    },
  });
}
