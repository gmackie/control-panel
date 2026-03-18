/**
 * Detect env vars from .env.example in a Gitea/GitHub repository
 *
 * POST /api/secrets/detect-env
 *
 * Reads .env.example from the app's repo, parses it,
 * and returns the keys with optional descriptions/defaults.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@repo/db";
import { applications, eq } from "@repo/db";

interface DetectedEnvVar {
  key: string;
  defaultValue: string;
  comment: string;
}

function parseEnvExample(content: string): DetectedEnvVar[] {
  const vars: DetectedEnvVar[] = [];
  let lastComment = "";

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Track comments as descriptions for the next variable
    if (trimmed.startsWith("#")) {
      lastComment = trimmed.replace(/^#+\s*/, "").trim();
      continue;
    }

    // Skip empty lines (reset comment)
    if (!trimmed) {
      lastComment = "";
      continue;
    }

    // Parse KEY=value or KEY="value" or KEY=
    const match = trimmed.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars.push({
        key,
        defaultValue: value,
        comment: lastComment,
      });
      lastComment = "";
    }
  }

  return vars;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId } = body as { applicationId: string };

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const [app] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1);

    if (!app?.repositoryUrl) {
      return NextResponse.json({ error: "No repository URL configured for this app" }, { status: 400 });
    }

    // Determine if it's a Gitea or GitHub repo
    const giteaUrl = process.env.GITEA_URL || "https://git.gmac.io";
    const giteaToken = process.env.GITEA_TOKEN;
    const isGitea = app.repositoryUrl.includes(giteaUrl.replace("https://", "").replace("http://", ""));

    let fileContent: string | null = null;

    if (isGitea && giteaToken) {
      // Extract owner/repo from URL
      const repoMatch = app.repositoryUrl.match(/\/([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (!repoMatch) {
        return NextResponse.json({ error: "Cannot parse repository URL" }, { status: 400 });
      }
      const [, owner, repo] = repoMatch;

      // Try .env.example, then .env.sample, then .env.template
      for (const filename of [".env.example", ".env.sample", ".env.template"]) {
        try {
          const res = await fetch(
            `${giteaUrl}/api/v1/repos/${owner}/${repo}/raw/${filename}`,
            {
              headers: {
                Authorization: `token ${giteaToken}`,
                Accept: "text/plain",
              },
              signal: AbortSignal.timeout(10000),
            }
          );
          if (res.ok) {
            fileContent = await res.text();
            break;
          }
        } catch {
          continue;
        }
      }
    } else if (app.repositoryUrl.includes("github.com")) {
      const githubToken = process.env.GITHUB_TOKEN;
      const repoMatch = app.repositoryUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
      if (repoMatch) {
        const [, owner, repo] = repoMatch;
        const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
        if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

        for (const filename of [".env.example", ".env.sample", ".env.template"]) {
          try {
            const res = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
              { headers, signal: AbortSignal.timeout(10000) }
            );
            if (res.ok) {
              fileContent = await res.text();
              break;
            }
          } catch {
            continue;
          }
        }
      }
    }

    if (!fileContent) {
      return NextResponse.json({
        found: false,
        message: "No .env.example found in repository",
        vars: [],
      });
    }

    const vars = parseEnvExample(fileContent);

    return NextResponse.json({
      found: true,
      message: `Found ${vars.length} environment variables`,
      vars,
    });
  } catch (err) {
    console.error("[secrets/detect-env] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Detection failed" },
      { status: 500 }
    );
  }
}
