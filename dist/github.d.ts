import type { IssueEvidence, PullEvidence, RepositoryRef } from "./types.js";
export interface GitHubChangedFile {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
}
export declare class GitHubApiError extends Error {
    readonly status: number;
    readonly remaining?: string | undefined;
    constructor(message: string, status: number, remaining?: string | undefined);
}
export declare class GitHubClient {
    readonly repository: RepositoryRef;
    private readonly token?;
    constructor(repository: RepositoryRef, token?: string | undefined);
    private request;
    private base;
    associatedPullRequests(sha: string): Promise<PullEvidence[]>;
    pullRequest(number: number): Promise<PullEvidence>;
    pullRequestFiles(number: number): Promise<GitHubChangedFile[]>;
    issue(number: number): Promise<IssueEvidence>;
    private reviews;
    private enrichPull;
}
export declare function extractIssueReferences(text: string): number[];
export declare function parseRepository(value: string): RepositoryRef;
//# sourceMappingURL=github.d.ts.map