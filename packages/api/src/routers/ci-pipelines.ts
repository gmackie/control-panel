import { z } from "zod";
import { router, publicProcedure } from "../trpc";

interface GiteaWorkflowRun {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
  run_number: number;
  started_at: string;
  completed_at: string | null;
  path: string;
}

async function fetchGiteaAPI<T>(path: string): Promise<T> {
  const baseUrl = (process.env.GITEA_URL || "https://git.gmac.io").replace(/\/$/, "");
  const token = process.env.GITEA_TOKEN || "";

  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Gitea API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export const ciPipelinesRouter = router({
  byRepo: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        limit: z.number().min(1).max(20).default(5),
      }),
    )
    .query(async ({ input }) => {
      const runs = await fetchGiteaAPI<{ workflow_runs: GiteaWorkflowRun[] }>(
        `/repos/${input.owner}/${input.repo}/actions/runs?limit=${input.limit}`,
      );
      return (runs.workflow_runs || []).map((run) => ({
        id: run.id,
        title: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        branch: run.head_branch,
        commitSha: run.head_sha,
        url: run.html_url,
        runNumber: run.run_number,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        workflow: run.path,
      }));
    }),

  latestRun: publicProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const runs = await fetchGiteaAPI<{ workflow_runs: GiteaWorkflowRun[] }>(
        `/repos/${input.owner}/${input.repo}/actions/runs?limit=1`,
      );
      const run = runs.workflow_runs?.[0];
      if (!run) return null;
      return {
        id: run.id,
        title: run.display_title,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        branch: run.head_branch,
        commitSha: run.head_sha,
        url: run.html_url,
        runNumber: run.run_number,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        workflow: run.path,
      };
    }),
});
