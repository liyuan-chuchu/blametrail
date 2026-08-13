import type { CommitEvidence, RepositoryRef, RiskFlag, TargetSpec } from "./types.js";
export declare function runGit(args: string[], cwd: string): Promise<string>;
export declare function findRepositoryRoot(cwd: string): Promise<string>;
export declare function parseTarget(value: string): TargetSpec;
export declare function validateTarget(root: string, target: TargetSpec): Promise<TargetSpec>;
interface BlamedRange {
    sha: string;
    startLine: number;
    endLine: number;
}
export declare function parseBlamePorcelain(output: string): BlamedRange[];
export declare function blameTarget(root: string, target: TargetSpec): Promise<BlamedRange[]>;
export declare function detectRiskFlags(text: string): RiskFlag[];
export declare function getCommitEvidence(root: string, sha: string, file: string, lines?: {
    startLine: number;
    endLine: number;
}): Promise<CommitEvidence>;
export declare function getFileHistory(root: string, file: string, maxCount: number): Promise<CommitEvidence[]>;
export declare function getOriginRemote(root: string): Promise<string | undefined>;
export declare function parseGitHubRemote(remote: string): RepositoryRef | undefined;
export declare function attachCommitUrls(commits: CommitEvidence[], repository?: RepositoryRef): CommitEvidence[];
export declare function truncate(value: string, maxLength: number): string;
export {};
//# sourceMappingURL=git.d.ts.map