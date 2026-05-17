import { useQuery } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { DashboardStats } from "@/types";
import { useWhoIsOut } from "@/hooks/useLeave";

// ---------------------------------------------------------------------------
// Re-export useWhoIsOut from useLeave for convenience
// ---------------------------------------------------------------------------
export { useWhoIsOut };

// ---------------------------------------------------------------------------
// Mock fallback stats used when the /stats endpoint is unavailable
// ---------------------------------------------------------------------------
const MOCK_STATS: DashboardStats = {
  pending_leaves: 0,
  approved_leaves_today: 0,
  total_ideas: 0,
  ideas_under_review: 0,
  upcoming_releases: 0,
  active_releases: 0,
};

// ---------------------------------------------------------------------------
// GET /stats — returns DashboardStats; falls back to mock data on 404
// ---------------------------------------------------------------------------
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      try {
        const { data } = await api.get<DashboardStats>("/stats/");
        return data;
      } catch (err: unknown) {
        const status =
          err &&
          typeof err === "object" &&
          "response" in err &&
          err.response &&
          typeof err.response === "object" &&
          "status" in err.response
            ? (err.response as { status: number }).status
            : null;

        if (status === 404) {
          return MOCK_STATS;
        }
        throw err;
      }
    },
    // Stats don't need to be super fresh — refresh every 60 seconds
    staleTime: 60_000,
  });
}
