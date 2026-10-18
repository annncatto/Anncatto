export const basePath = (process.env.BASE_PATH || "").replace(/\/+$/, "");

if (basePath && !/^(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/.test(basePath)) {
  throw Error("BASE_PATH must be empty or a path such as /Anncatto.");
}

export function stripBasePath(urlPath) {
  if (!urlPath.startsWith(`${basePath}/`)) {
    throw Error(`Path outside site base: ${urlPath}`);
  }
  return urlPath.slice(basePath.length);
}
