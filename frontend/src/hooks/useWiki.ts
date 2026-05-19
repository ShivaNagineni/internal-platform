import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ADOWikiPage, WikiDocument, WikiDocumentCreate, WikiDocumentUpdate } from "@/types";

const wikiKeys = {
  all: ["wiki"] as const,
  lists: () => [...wikiKeys.all, "list"] as const,
  categories: () => [...wikiKeys.all, "categories"] as const,
  adoPages: () => [...wikiKeys.all, "ado-pages"] as const,
  adoContent: (project: string, wikiId: string, path: string) =>
    [...wikiKeys.all, "ado-content", project, wikiId, path] as const,
};

export function useWikiDocuments(search?: string, category?: string) {
  return useQuery<WikiDocument[]>({
    queryKey: [...wikiKeys.lists(), { search, category }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await api.get<WikiDocument[]>("/wiki/", { params });
      return data;
    },
  });
}

export function useWikiCategories() {
  return useQuery<string[]>({
    queryKey: wikiKeys.categories(),
    queryFn: async () => {
      const { data } = await api.get<string[]>("/wiki/categories");
      return data;
    },
  });
}

export function useCreateWikiDocument() {
  const qc = useQueryClient();
  return useMutation<WikiDocument, Error, WikiDocumentCreate>({
    mutationFn: async (payload) => {
      const { data } = await api.post<WikiDocument>("/wiki/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.lists() });
      qc.invalidateQueries({ queryKey: wikiKeys.categories() });
    },
  });
}

export function useUpdateWikiDocument() {
  const qc = useQueryClient();
  return useMutation<WikiDocument, Error, { id: string; payload: WikiDocumentUpdate }>({
    mutationFn: async ({ id, payload }) => {
      const { data } = await api.patch<WikiDocument>(`/wiki/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.lists() });
      qc.invalidateQueries({ queryKey: wikiKeys.categories() });
    },
  });
}

export function useADOWikiPages() {
  return useQuery<ADOWikiPage[]>({
    queryKey: wikiKeys.adoPages(),
    queryFn: async () => {
      const { data } = await api.get<ADOWikiPage[]>("/wiki/ado/pages");
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useADOWikiPageContent(
  project: string,
  wikiId: string,
  path: string,
  enabled: boolean
) {
  return useQuery<string>({
    queryKey: wikiKeys.adoContent(project, wikiId, path),
    queryFn: async () => {
      const { data } = await api.get<{ content: string }>("/wiki/ado/page-content", {
        params: { project, wiki_id: wikiId, path },
      });
      return data.content;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeleteWikiDocument() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.delete(`/wiki/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wikiKeys.lists() });
      qc.invalidateQueries({ queryKey: wikiKeys.categories() });
    },
  });
}
