export type OutputFormat = "text" | "markdown" | "json";
export interface RepositoryRef {
    owner: string;
    repo: string;
}
export interface TargetSpec {
    file: string;
    startLine: number;
    endLine: number;
}
export type RiskFlag = "bug-fix" | "compatibility" | "performance" | "regression" | "revert" | "security" | "workaround";
export interface CommitEvidence {
    sha: string;
    shortSha: string;
    author: string;
    authoredAt: string;
    subject: string;
    message: string;
    file: string;
    startLine?: number;
    endLine?: number;
    diffExcerpt: string;
    url?: string;
    flags: RiskFlag[];
}
export interface ReviewEvidence {
    author: string;
    state: string;
    body: string;
    submittedAt?: string;
    url?: string;
}
export interface PullEvidence {
    number: number;
    title: string;
    body: string;
    state: string;
    author: string;
    url: string;
    mergedAt?: string;
    flags: RiskFlag[];
    linkedIssues: number[];
    reviews: ReviewEvidence[];
}
export interface IssueEvidence {
    number: number;
    title: string;
    body: string;
    state: string;
    author: string;
    url: string;
    flags: RiskFlag[];
}
export interface ExplainReport {
    kind: "explain";
    generatedAt: string;
    repositoryRoot: string;
    repository?: RepositoryRef;
    target: TargetSpec;
    commits: CommitEvidence[];
    pullRequests: PullEvidence[];
    issues: IssueEvidence[];
    warnings: string[];
}
export interface ChangedFileEvidence {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patchExcerpt: string;
    historicalCommits: CommitEvidence[];
    flags: RiskFlag[];
}
export interface ReviewReport {
    kind: "review";
    generatedAt: string;
    repositoryRoot: string;
    repository: RepositoryRef;
    pullRequest: PullEvidence;
    files: ChangedFileEvidence[];
    relatedPullRequests: PullEvidence[];
    issues: IssueEvidence[];
    warnings: string[];
}
export interface AnalyzeOptions {
    cwd: string;
    offline: boolean;
    repository?: RepositoryRef;
    maxCommits: number;
    maxFiles: number;
    token?: string;
}
//# sourceMappingURL=types.d.ts.map