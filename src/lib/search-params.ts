export function parseBranchParam(searchParams: {
  branch?: string | string[];
}): string | undefined {
  const { branch } = searchParams;

  if (typeof branch !== "string") {
    return undefined;
  }

  const normalizedBranch = branch.trim();
  return normalizedBranch.length > 0 ? normalizedBranch : undefined;
}
