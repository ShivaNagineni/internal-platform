import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { Sprint, Story, StoryCreate, StoryUpdate } from "@/types";

const storyKeys = {
  all: ["stories"] as const,
  lists: () => [...storyKeys.all, "list"] as const,
  detail: (id: number) => [...storyKeys.all, "detail", id] as const,
};

export function useStories() {
  return useQuery<Story[]>({
    queryKey: storyKeys.lists(),
    queryFn: async () => {
      const { data } = await api.get<Story[]>("/stories/");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useStory(id: number) {
  return useQuery<Story>({
    queryKey: storyKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Story>(`/stories/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateStory() {
  const qc = useQueryClient();
  return useMutation<Story, Error, StoryCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post<Story>("/stories/", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.lists() }),
  });
}

export function useUpdateStory() {
  const qc = useQueryClient();
  return useMutation<Story, Error, { id: number; payload: StoryUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<Story>(`/stories/${id}`, payload);
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: storyKeys.lists() });
      qc.invalidateQueries({ queryKey: storyKeys.detail(id) });
    },
  });
}

export function useDeleteStory() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await api.delete(`/stories/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.lists() }),
  });
}

export function useUpdateStoryState() {
  const qc = useQueryClient();
  return useMutation<Story, Error, { id: number; state: string }>({
    mutationFn: async ({ id, state }) => {
      const { data } = await api.patch<Story>(`/stories/${id}/state`, { state });
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: storyKeys.lists() });
      qc.invalidateQueries({ queryKey: storyKeys.detail(id) });
      qc.invalidateQueries({ queryKey: [...storyKeys.all, "sprints"] });
    },
  });
}

export function useSprints() {
  return useQuery<Sprint[]>({
    queryKey: [...storyKeys.all, "sprints"] as const,
    queryFn: async () => {
      const { data } = await api.get<Sprint[]>("/stories/sprints");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useStoriesProjects() {
  return useQuery<string[]>({
    queryKey: [...storyKeys.all, "projects"] as const,
    queryFn: async () => {
      const { data } = await api.get<string[]>("/stories/projects");
      return data;
    },
    staleTime: Infinity,
  });
}

export function useMoveStoryToSprint() {
  const qc = useQueryClient();
  return useMutation<Story, Error, { id: number; sprintPath: string }>({
    mutationFn: async ({ id, sprintPath }) => {
      const { data } = await api.patch<Story>(`/stories/${id}/sprint`, { sprint_path: sprintPath });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: storyKeys.lists() });
      qc.invalidateQueries({ queryKey: [...storyKeys.all, "sprints"] });
    },
  });
}

export function useStoriesStates() {
  return useQuery<Record<string, string[]>>({
    queryKey: [...storyKeys.all, "states"] as const,
    queryFn: async () => {
      const { data } = await api.get<Record<string, string[]>>("/stories/states");
      return data;
    },
    staleTime: Infinity,
  });
}
