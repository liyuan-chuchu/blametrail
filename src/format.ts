import type {
  CommitEvidence,
  ExplainReport,
  IssueEvidence,
  OutputFormat,
  PullEvidence,
  ReviewReport,
  RiskFlag,
} from "./types.js";

export function formatReport(report: ExplainReport | ReviewReport, format: OutputFormat): string {
  if (format === "json") return JSON.stringify(report, null, 2);
  if (report.kind === "explain") {
    return format === "markdown" ? explainMarkdown(report) : explainText(report);
  }
  return format === "markdown" ? reviewMarkdown(report) : reviewText(report);
}

function location(commit: CommitEvidence): string {
  if (commit.startLine === undefined) return commit.file;
  const end = commit.endLine && commit.endLine !== commit.startLine ? `-${commit.endLine}` : "";
  return `${commit.file}:${commit.startLine}${end}`;
}

function flagsText(flags: RiskFlag[]): string {
  return flags.length > 0 ? flags.map((flag) => `[${flag}]`).join(" ") : "[context]";
}

function linkOrSha(commit: CommitEvidence): string {
  return commit.url ? `${commit.shortSha} (${commit.url})` : commit.shortSha;
}

function explainText(report: ExplainReport): string {
  const lines = [
    `BlameTrail — evidence for ${report.target.file}:${report.target.startLine}-${report.target.endLine}`,
    report.repository ? `Repository: ${report.repository.owner}/${report.repository.repo}` : "Repository: local only",
    "",
    "Commits",
  ];
  for (const commit of report.commits) {
    lines.push(`- ${flagsText(commit.flags)} ${linkOrSha(commit)} ${commit.subject}`);
    lines.push(`  ${commit.author} · ${commit.authoredAt} · ${location(commit)}`);
  }
  appendPullsText(lines, report.pullRequests);
  appendIssuesText(lines, report.issues);
  appendWarningsText(lines, report.warnings);
  lines.push("", "Evidence is historical context, not a correctness verdict. Verify sources before changing code.");
  return lines.join("\n");
}

function reviewText(report: ReviewReport): string {
  const lines = [
    `BlameTrail — historical review for PR #${report.pullRequest.number}`,
    `${report.pullRequest.title} · ${report.pullRequest.url}`,
    `Repository: ${report.repository.owner}/${report.repository.repo}`,
    "",
    "Changed files",
  ];
  for (const file of report.files) {
    lines.push(`- ${flagsText(file.flags)} ${file.filename} (+${file.additions}/-${file.deletions})`);
    for (const commit of file.historicalCommits) {
      lines.push(`  - ${flagsText(commit.flags)} ${linkOrSha(commit)} ${commit.subject}`);
    }
  }
  appendPullsText(lines, report.relatedPullRequests, "Related historical pull requests");
  appendIssuesText(lines, report.issues);
  appendWarningsText(lines, report.warnings);
  lines.push("", "Risk flags are leads for human review, not automated findings.");
  return lines.join("\n");
}

function appendPullsText(lines: string[], pulls: PullEvidence[], title = "Pull requests"): void {
  if (pulls.length === 0) return;
  lines.push("", title);
  for (const pull of pulls) {
    lines.push(`- ${flagsText(pull.flags)} #${pull.number} ${pull.title} · ${pull.url}`);
    for (const review of pull.reviews.slice(0, 3)) {
      lines.push(`  - review ${review.state} by ${review.author}: ${oneLine(review.body, 180)}`);
    }
  }
}

function appendIssuesText(lines: string[], issues: IssueEvidence[]): void {
  if (issues.length === 0) return;
  lines.push("", "Linked issues");
  for (const issue of issues) {
    lines.push(`- ${flagsText(issue.flags)} #${issue.number} ${issue.title} · ${issue.url}`);
  }
}

function appendWarningsText(lines: string[], warnings: string[]): void {
  if (warnings.length === 0) return;
  lines.push("", "Warnings", ...warnings.map((warning) => `- ${warning}`));
}

function explainMarkdown(report: ExplainReport): string {
  const lines = [
    `## BlameTrail: \`${report.target.file}:${report.target.startLine}-${report.target.endLine}\``,
    "",
    "### Commit evidence",
    "",
  ];
  for (const commit of report.commits) {
    const reference = commit.url ? `[\`${commit.shortSha}\`](${commit.url})` : `\`${commit.shortSha}\``;
    lines.push(`- ${flagsText(commit.flags)} ${reference} — ${escapeMarkdown(commit.subject)}`);
    lines.push(`  - ${escapeMarkdown(commit.author)}, ${commit.authoredAt}; \`${location(commit)}\``);
  }
  appendPullsMarkdown(lines, report.pullRequests, "Pull request evidence");
  appendIssuesMarkdown(lines, report.issues);
  appendWarningsMarkdown(lines, report.warnings);
  lines.push("", "_Historical evidence only. Verify the linked sources before changing code._");
  return lines.join("\n");
}

function reviewMarkdown(report: ReviewReport): string {
  const lines = [
    `## BlameTrail historical review: [#${report.pullRequest.number}](${report.pullRequest.url})`,
    "",
    `**${escapeMarkdown(report.pullRequest.title)}**`,
    "",
    "| File | Change | Historical flags |",
    "| --- | ---: | --- |",
  ];
  for (const file of report.files) {
    lines.push(`| \`${file.filename}\` | +${file.additions}/-${file.deletions} | ${flagsText(file.flags)} |`);
  }
  lines.push("", "### Historical commits", "");
  for (const file of report.files.filter((item) => item.historicalCommits.length > 0)) {
    lines.push(`#### \`${file.filename}\``, "");
    for (const commit of file.historicalCommits) {
      const reference = commit.url ? `[\`${commit.shortSha}\`](${commit.url})` : `\`${commit.shortSha}\``;
      lines.push(`- ${flagsText(commit.flags)} ${reference} — ${escapeMarkdown(commit.subject)}`);
    }
    lines.push("");
  }
  appendPullsMarkdown(lines, report.relatedPullRequests, "Related historical pull requests");
  appendIssuesMarkdown(lines, report.issues);
  appendWarningsMarkdown(lines, report.warnings);
  lines.push("", "_Risk flags are evidence leads for maintainers, not automated correctness findings._");
  return lines.join("\n");
}

function appendPullsMarkdown(lines: string[], pulls: PullEvidence[], title: string): void {
  if (pulls.length === 0) return;
  lines.push("", `### ${title}`, "");
  for (const pull of pulls) {
    lines.push(`- ${flagsText(pull.flags)} [#${pull.number}: ${escapeMarkdown(pull.title)}](${pull.url})`);
    for (const review of pull.reviews.slice(0, 3)) {
      lines.push(`  - **${review.state}** by ${escapeMarkdown(review.author)}: ${escapeMarkdown(oneLine(review.body, 180))}`);
    }
  }
}

function appendIssuesMarkdown(lines: string[], issues: IssueEvidence[]): void {
  if (issues.length === 0) return;
  lines.push("", "### Linked issues", "");
  for (const issue of issues) {
    lines.push(`- ${flagsText(issue.flags)} [#${issue.number}: ${escapeMarkdown(issue.title)}](${issue.url})`);
  }
}

function appendWarningsMarkdown(lines: string[], warnings: string[]): void {
  if (warnings.length === 0) return;
  lines.push("", "### Warnings", "", ...warnings.map((warning) => `- ${escapeMarkdown(warning)}`));
}

function oneLine(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}…` : normalized;
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]<>])/g, "\\$1");
}
