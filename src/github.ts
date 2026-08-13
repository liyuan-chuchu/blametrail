import type {
  IssueEvidence,
  PullEvidence,
  RepositoryRef,
  ReviewEvidence,
} from "./types.js";
import { detectRiskFlags, truncate } from "./git.js";

interface GitHubUser {
  login?: string;
}

interface GitHubPull {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  merged_at: string | null;
  user?: GitHubUser;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  user?: GitHubUser;
}

interface GitHubReview {
  state: string;
  body: string | null;
  submitted_at: string | null;
  html_url: string;
  user?: GitHubUser;
}

export interface GitHubChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly remaining?: string,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

export class GitHubClient {
  constructor(
    readonly repository: RepositoryRef,
    private readonly token?: string,
  ) {}

  private async request<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "blametrail/0.1.0",
      "X-GitHub-Api-Version": "2026-03-10",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const response = await fetch(`https://api.github.com${path}`, { headers });
    if (!response.ok) {
      const body = await response.text();
      throw new GitHubApiError(
        `GitHub API returned ${response.status}: ${truncate(body, 500)}`,
        response.status,
        response.headers.get("x-ratelimit-remaining") ?? undefined,
      );
    }
    return (await response.json()) as T;
  }

  private base(path: string): string {
    return `/repos/${encodeURIComponent(this.repository.owner)}/${encodeURIComponent(this.repository.repo)}${path}`;
  }

  async associatedPullRequests(sha: string): Promise<PullEvidence[]> {
    const pulls = await this.request<GitHubPull[]>(
      this.base(`/commits/${encodeURIComponent(sha)}/pulls?per_page=10`),
    );
    return Promise.all(pulls.map((pull) => this.enrichPull(pull)));
  }

  async pullRequest(number: number): Promise<PullEvidence> {
    const pull = await this.request<GitHubPull>(this.base(`/pulls/${number}`));
    return this.enrichPull(pull);
  }

  async pullRequestFiles(number: number): Promise<GitHubChangedFile[]> {
    return this.request<GitHubChangedFile[]>(this.base(`/pulls/${number}/files?per_page=100`));
  }

  async issue(number: number): Promise<IssueEvidence> {
    const issue = await this.request<GitHubIssue>(this.base(`/issues/${number}`));
    const body = issue.body ?? "";
    return {
      number: issue.number,
      title: issue.title,
      body: truncate(body, 4_000),
      state: issue.state,
      author: issue.user?.login ?? "unknown",
      url: issue.html_url,
      flags: detectRiskFlags(`${issue.title}\n${body}`),
    };
  }

  private async reviews(number: number): Promise<ReviewEvidence[]> {
    const reviews = await this.request<GitHubReview[]>(this.base(`/pulls/${number}/reviews?per_page=30`));
    return reviews
      .filter((review) => Boolean(review.body?.trim()))
      .slice(0, 10)
      .map((review) => {
        const evidence: ReviewEvidence = {
          author: review.user?.login ?? "unknown",
          state: review.state,
          body: truncate(review.body ?? "", 2_000),
        };
        if (review.submitted_at) evidence.submittedAt = review.submitted_at;
        if (review.html_url) evidence.url = review.html_url;
        return evidence;
      });
  }

  private async enrichPull(pull: GitHubPull): Promise<PullEvidence> {
    const body = pull.body ?? "";
    let reviews: ReviewEvidence[] = [];
    try {
      reviews = await this.reviews(pull.number);
    } catch {
      // The core evidence remains useful when reviews are unavailable.
    }
    const result: PullEvidence = {
      number: pull.number,
      title: pull.title,
      body: truncate(body, 5_000),
      state: pull.state,
      author: pull.user?.login ?? "unknown",
      url: pull.html_url,
      flags: detectRiskFlags(`${pull.title}\n${body}\n${reviews.map((review) => review.body).join("\n")}`),
      linkedIssues: extractIssueReferences(body),
      reviews,
    };
    if (pull.merged_at) result.mergedAt = pull.merged_at;
    return result;
  }
}

export function extractIssueReferences(text: string): number[] {
  const references = new Set<number>();
  const patterns = [
    /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?[ \t]*(?:[\w.-]+\/[\w.-]+)?#(\d+)/gi,
    /\b(?:issue|bug)\s*#(\d+)/gi,
    /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1];
      if (value) references.add(Number.parseInt(value, 10));
    }
  }
  return [...references].filter(Number.isSafeInteger).sort((a, b) => a - b);
}

export function parseRepository(value: string): RepositoryRef {
  const match = value.trim().match(/^([^/\s]+)\/([^/\s]+)$/);
  if (!match?.[1] || !match[2]) throw new Error("Repository must use the form owner/name.");
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}
