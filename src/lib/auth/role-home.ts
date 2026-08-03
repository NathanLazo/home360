import type { UserRole } from "../../../generated/prisma";

export const homeForRole = (role: UserRole): "/admin" | "/dashboard" | "/" => {
  if (role === "ADMIN") {
    return "/admin";
  }

  if (role === "BUSINESS") {
    return "/dashboard";
  }

  return "/";
};

export const isRouteOrDescendant = (pathname: string, root: string): boolean =>
  pathname === root || pathname.startsWith(`${root}/`);

const INTERNAL_URL_ORIGIN = "https://home360.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MAX_DECODE_PASSES = 3;

function hasUnsafePathSyntax(pathname: string): boolean {
  return (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    pathname.includes("?") ||
    pathname.includes("#") ||
    CONTROL_CHARACTERS.test(pathname)
  );
}

function canonicalizeInternalPath(candidate: unknown): string | null {
  if (
    typeof candidate !== "string" ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    CONTROL_CHARACTERS.test(candidate)
  ) {
    return null;
  }

  const initialUrl = new URL(candidate, INTERNAL_URL_ORIGIN);
  if (initialUrl.origin !== INTERNAL_URL_ORIGIN) return null;

  let decodedPathname = initialUrl.pathname;

  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    if (hasUnsafePathSyntax(decodedPathname)) return null;

    let nextPathname: string;
    try {
      nextPathname = decodeURIComponent(decodedPathname);
    } catch {
      return null;
    }

    if (nextPathname === decodedPathname) {
      const canonicalUrl = new URL(decodedPathname, INTERNAL_URL_ORIGIN);
      canonicalUrl.search = initialUrl.search;
      canonicalUrl.hash = initialUrl.hash;
      return `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`;
    }

    decodedPathname = nextPathname;
  }

  try {
    if (decodeURIComponent(decodedPathname) !== decodedPathname) return null;
  } catch {
    return null;
  }

  if (hasUnsafePathSyntax(decodedPathname)) return null;
  const canonicalUrl = new URL(decodedPathname, INTERNAL_URL_ORIGIN);
  canonicalUrl.search = initialUrl.search;
  canonicalUrl.hash = initialUrl.hash;
  return `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`;
}

export function isSafeInternalPath(candidate: unknown): candidate is string {
  return canonicalizeInternalPath(candidate) !== null;
}

export function safeCallbackForRole(
  role: UserRole,
  candidate: unknown,
): string | null {
  const canonicalPath = canonicalizeInternalPath(candidate);
  if (!canonicalPath) return null;
  const pathname = new URL(canonicalPath, INTERNAL_URL_ORIGIN).pathname;

  if (role === "ADMIN" && isRouteOrDescendant(pathname, "/admin")) {
    return canonicalPath;
  }

  if (role === "BUSINESS" && isRouteOrDescendant(pathname, "/dashboard")) {
    return canonicalPath;
  }

  return null;
}
