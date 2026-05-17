import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { User } from "@/types";

export function useUsers(sortBy: string = "points") {
  return useQuery<User[]>({
    queryKey: ["users", sortBy],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users/", {
        params: { sort_by: sortBy },
      });
      return data;
    },
  });
}
