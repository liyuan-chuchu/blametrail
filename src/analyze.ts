import {
  attachCommitUrls,
  blameTarget,
  detectRiskFlags,
  findRepositoryRoot,
  getCommitEvidence,
  getFileHistory,
  getOriginRemote,
  parseGitHubRemote,
  validateTarget,
  truncate,
} from "./git.js";
import { GitHubClient } from "./github.js";
import type {
  AnalyzeOptions,
  ChangedFileEvidence,
  CommitEvidence,
  ExplainReport,
  IssueEvidence,
  PullEvidence,
  RepositoryRef,
  ReviewReport,
  RiskFlag,
  TargetSpec,
} from "./types.js";

async function resolveRepository(root: string, override?: RepositoryRef): Promise<RepositoryRef | undefined> {
  if (override) return override;
  const remote = await getOriginRemote(root);
  return remote ? parseGitHubRemote(remote) : undefined;
}

function tokenFromEnvironment(explicit?: string): string | undefined {
  return explicit ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
}

function uniquePulls(pulls: PullEvidence[]): PullEvidence[] {
  return [...new Map(pulls.map((pull) => [pull.number, pull])).values()].sort(
    (a, b) => a.number - b.number,
  );
}

function uniqueIssues(issues: IssueEvidence[]): IssueEvidence[] {
  return [...new Map(issues.map((issue) => [issue.number, issue])).values()].sort(
    (a, b) => a.number - b.number,
  );
}

async function fetchLinkedIssues(
  client: GitHubClient,
  pulls: PullEvidence[],
  warnings: string[],
): Promise<IssueEvidence[]> {
  const numbers = [...new Set(pulls.flatMap((pull) => pull.linkedIssues))].slice(0, 20);
  const issues: IssueEvidence[] = [];
  for (const number of numbers) {
    try {
      issues.push(await client.issue(number));
    } catch (error) {
      warnings.push(`Could not fetch issue #${number}: ${messageOf(error)}`);
    }
  }
  return uniqueIssues(issues);
}

export async function analyzeExplain(
  targetInput: TargetSpec,
  options: AnalyzeOptions,
): Promise<ExplainReport> {
  const root = await findRepositoryRoot(options.cwd);
  const target = await validateTarget(root, targetInput);
  const repository = await resolveRepository(root, options.repository);
  const warnings: string[] = [];
  const blamedRanges = (await blameTarget(root, target)).slice(0, options.maxCommits);
  const rawCommits: CommitEvidence[] = [];
  for (const range of blamedRanges) {
    rawCommits.push(
      await getCommitEvidence(root, range.sha, target.file, {
        startLine: range.startLine,
        endLine: range.endLine,
      }),
    );
  }
  const commits = attachCommitUrls(rawCommits, repository);
  const pulls: PullEvidence[] = [];
  let issues: IssueEvidence[] = [];

  if (options.offline) {
    warnings.push("Offline mode: GitHub pull request, review, and issue evidence was not requested.");
  } else if (!repository) {
    warnings.push("No GitHub origin was detected. Use --repo owner/name to request remote evidence.");
  } else {
    const client = new GitHubClient(repository, tokenFromEnvironment(options.token));
    for (const commit of commits) {
      try {
        pulls.push(...(await client.associatedPullRequests(commit.sha)));
      } catch (error) {
        warnings.push(`Could not enrich commit ${commit.shortSha}: ${messageOf(error)}`);
      }
    }
    issues = await fetchLinkedIssues(client, uniquePulls(pulls), warnings);
  }

  const report: ExplainReport = {
    kind: "explain",
    generatedAt: new Date().toISOString(),
    repositoryRoot: root,
    target,
    commits,
    pullRequests: uniquePulls(pulls),
    issues,
    warnings,
  };
  if (repository) report.repository = repository;
  return report;
}

function selectHistoricalCommits(commits: CommitEvidence[], max: number): CommitEvidence[] {
  const selected = new Map<string, CommitEvidence>();
  for (const commit of commits.filter((item) => item.flags.length > 0)) selected.set(commit.sha, commit);
  for (const commit of commits.slice(0, 2)) selected.set(commit.sha, commit);
  return [...selected.values()]
    .sort((a, b) => b.authoredAt.localeCompare(a.authoredAt))
    .slice(0, max);
}

function aggregateFlags(commits: CommitEvidence[], extraText = ""): RiskFlag[] {
  return [...new Set([...commits.flatMap((commit) => commit.flags), ...detectRiskFlags(extraText)])];
}

export async function analyzeReview(number: number, options: AnalyzeOptions): Promise<ReviewReport> {
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Pull request number must be positive.");
  if (options.offline) throw new Error("The review command needs GitHub access; remove --offline.");

  const root = await findRepositoryRoot(options.cwd);
  const repository = await resolveRepository(root, options.repository);
  if (!repository) throw new Error("No GitHub origin was detected. Use --repo owner/name.");

  const warnings: string[] = [];
  const client = new GitHubClient(repository, tokenFromEnvironment(options.token));
  const pullRequest = await client.pullRequest(number);
  const changed = await client.pullRequestFiles(number);
  if (changed.length > options.maxFiles) {
    warnings.push(`Only the first ${options.maxFiles} of ${changed.length} changed files were analyzed.`);
  }

  const files: ChangedFileEvidence[] = [];
  for (const file of changed.slice(0, options.maxFiles)) {
    const fullHistory = await getFileHistory(root, file.filename, Math.max(options.maxCommits * 3, 12));
    const history = attachCommitUrls(selectHistoricalCommits(fullHistory, options.maxCommits), repository);
    files.push({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patchExcerpt: truncate(file.patch ?? "", 6_000),
      historicalCommits: history,
      flags: aggregateFlags(history, file.patch ?? ""),
    });
  }

  const relatedPulls: PullEvidence[] = [];
  const candidates = files
    .flatMap((file) => file.historicalCommits)
    .filter((commit) => commit.flags.length > 0)
    .slice(0, options.maxCommits);
  for (const commit of candidates) {
    try {
      relatedPulls.push(...(await client.associatedPullRequests(commit.sha)));
    } catch (error) {
      warnings.push(`Could not enrich historical commit ${commit.shortSha}: ${messageOf(error)}`);
    }
  }

  const issues = await fetchLinkedIssues(client, [pullRequest, ...relatedPulls], warnings);
  return {
    kind: "review",
    generatedAt: new Date().toISOString(),
    repositoryRoot: root,
    repository,
    pullRequest,
    files,
    relatedPullRequests: uniquePulls(relatedPulls).filter((pull) => pull.number !== number),
    issues,
    warnings,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
