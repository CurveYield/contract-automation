import path from 'node:path';

function requireRelativeSegments(projectPath) {
  if (typeof projectPath !== 'string' || projectPath.length === 0) {
    throw new Error('projectPath must be a non-empty relative path');
  }
  if (path.isAbsolute(projectPath) || /^[A-Za-z]:[\\/]/.test(projectPath)) {
    throw new Error('projectPath must be a relative path');
  }
  const normalized = projectPath.replaceAll('\\', '/');
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('projectPath must use safe path segments inside the job directory');
  }
  return segments;
}

export function resolveJobProjectRoot(jobFile, projectPath) {
  if (typeof jobFile !== 'string' || jobFile.length === 0) {
    throw new Error('jobFile must be a non-empty path');
  }
  const absoluteJobFile = path.resolve(jobFile);
  const jobDirectory = path.dirname(absoluteJobFile);
  const projectRoot = path.resolve(jobDirectory, ...requireRelativeSegments(projectPath));
  if (!projectRoot.startsWith(`${jobDirectory}${path.sep}`)) {
    throw new Error('projectPath must resolve inside the job directory');
  }
  return projectRoot;
}
