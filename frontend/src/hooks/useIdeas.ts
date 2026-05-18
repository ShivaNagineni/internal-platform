import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Idea, IdeaCreate, IdeaUpdate } from "@/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------
export const ideaKeys = {
  all: ["ideas"] as const,
  lists: (filters?: { status?: string; category?: string }) =>
    [...ideaKeys.all, "list", filters ?? {}] as const,
  detail: (id: string) => [...ideaKeys.all, "detail", id] as const,
};

// ---------------------------------------------------------------------------
// GET /ideas/
// ---------------------------------------------------------------------------
export function useIdeas(filters?: { status?: string; category?: string }) {
  return useQuery<Idea[]>({
    queryKey: ideaKeys.lists(filters),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.status) params.status = filters.status;
      if (filters?.category) params.category = filters.category;
      const { data } = await api.get<Idea[]>("/ideas/", { params });
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// GET /ideas/{id}
// ---------------------------------------------------------------------------
export function useIdea(id: string) {
  return useQuery<Idea>({
    queryKey: ideaKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Idea>(`/ideas/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// POST /ideas/
// ---------------------------------------------------------------------------
export function useCreateIdea() {
  const queryClient = useQueryClient();

  return useMutation<Idea, Error, IdeaCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Idea>("/ideas/", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ideaKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// PATCH /ideas/{id}
// ---------------------------------------------------------------------------
export function useUpdateIdea() {
  const queryClient = useQueryClient();

  return useMutation<Idea, Error, { id: string; payload: IdeaUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<Idea>(`/ideas/${id}`, payload);
      return data;
    },
    onSuccess: (updatedIdea, { id }) => {
      queryClient.setQueryData<Idea[]>(ideaKeys.all, (old) => {
        if (!old) return old;
        return old.map((item) => (item.id === id ? updatedIdea : item));
      });
      queryClient.setQueryData<Idea>(ideaKeys.detail(id), updatedIdea);
      queryClient.invalidateQueries({ queryKey: ideaKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// POST /ideas/{id}/vote
// ---------------------------------------------------------------------------
export function useVoteIdea() {
  const queryClient = useQueryClient();

  return useMutation<Idea, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.post<Idea>(`/ideas/${id}/vote`);
      return data;
    },
    onSuccess: (updatedIdea, id) => {
      queryClient.setQueryData<Idea[]>(ideaKeys.all, (old) => {
        if (!old) return old;
        return old.map((item) => (item.id === id ? updatedIdea : item));
      });
      queryClient.setQueryData<Idea>(ideaKeys.detail(id), updatedIdea);
      queryClient.invalidateQueries({ queryKey: ideaKeys.all });
      // Votes change user points — keep leaderboard in sync
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// ---------------------------------------------------------------------------
// DELETE /ideas/{id}
// ---------------------------------------------------------------------------
export function useDeleteIdea() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/ideas/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ideaKeys.all });
    },
  });
}
