// Generator proyek Express dari graf node + pengaturan.
// Murni (tanpa Express) supaya bisa dites terpisah dari server builder.
import fs from 'fs';
import { ValidationError } from './errors.js';
import { renderTree, resolveProjectDir, writeProject } from './fs.js';
import { analyzeGraph } from './graph.js';
import { normalizeSettings } from './settings.js';
import { controllerJs } from './templates/controllers.js';
import { dbConfigJs, initMigrationSql, migrateJs, mongoModelJs } from './templates/database.js';
import { authJs, createTokenJs, validateJs } from './templates/middleware.js';
import { dockerfile, dockerignore, envFile, gitignore, indexJs, packageJson, readme } from './templates/project.js';
import { routeJs, validationSchema } from './templates/routes.js';
import { composeYml, usesCompose } from './templates/compose.js';
import { postmanCollection, postmanEnvironment } from './templates/postman.js';

export { ConflictError, ValidationError } from './errors.js';
export { DEFAULT_SETTINGS, normalizeSettings } from './settings.js';
export { analyzeGraph } from './graph.js';

export function buildFiles(settings, resources, auth) {
  const files = {};
  files['package.json'] = packageJson(settings, auth);
  files['index.js'] = indexJs(settings, resources, auth);

  for (const [r, info] of resources) {
    files[`routes/${r}.js`] = routeJs(settings, r, info);
    files[`controllers/${r}Controller.js`] = controllerJs(settings, r, info);
  }

  const needsValidate = [...resources.values()].some((r) => r.endpoints.some((ep) => validationSchema(ep, 'int')));
  if (needsValidate) files['middleware/validate.js'] = validateJs(settings);
  if (auth.apiKey || auth.jwt) files['middleware/auth.js'] = authJs(settings, auth);
  if (auth.jwt) files['scripts/create-token.js'] = createTokenJs(settings);

  const dbResources = [...resources].filter(([, i]) => i.usesDb).map(([r]) => r);
  if (settings.database !== 'none') {
    files['config/db.js'] = dbConfigJs(settings);
    if (settings.database === 'mongodb') {
      for (const r of dbResources) files[`models/${r}.js`] = mongoModelJs(settings, r);
    } else {
      // SQL: skema dikelola lewat migration bernomor + runner (npm run db:migrate)
      files['scripts/migrate.js'] = migrateJs(settings);
      if (dbResources.length) files['db/migrations/001_init.sql'] = initMigrationSql(settings, dbResources);
      else files['db/migrations/.gitkeep'] = '';
    }
  }

  files['.env.example'] = envFile(settings, auth, { example: true });
  // compose membaca .env untuk kredensial, jadi .env tetap dibuat walau dotenv nonaktif
  if (settings.middleware.dotenv || usesCompose(settings)) files['.env'] = envFile(settings, auth, { example: false });
  if (settings.tooling.gitignore) files['.gitignore'] = gitignore(settings);
  if (settings.tooling.readme) files['README.md'] = readme(settings, resources, auth);
  if (settings.tooling.dockerfile) {
    files['Dockerfile'] = dockerfile(settings);
    files['.dockerignore'] = dockerignore(settings);
  }
  if (usesCompose(settings)) files['docker-compose.yml'] = composeYml(settings);
  if (settings.tooling.postman) {
    files[`postman/${settings.name.replace(/^@[^/]+\//, '')}.postman_collection.json`] = postmanCollection(settings, resources);
    files['postman/local.postman_environment.json'] = postmanEnvironment(settings, auth);
  }
  return files;
}

export function generateProject({ nodes, edges, projectName, settings: rawSettings }, outputRoot) {
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new ValidationError({ graph: 'Payload harus berisi array nodes dan edges.' });
  }
  const settings = normalizeSettings(rawSettings, projectName);
  const { resources, warnings, auth } = analyzeGraph(nodes, edges, settings);
  const files = buildFiles(settings, resources, auth);
  const { folder, dir } = resolveProjectDir(outputRoot, settings.name);

  fs.mkdirSync(outputRoot, { recursive: true });
  writeProject(dir, folder, files);

  return {
    folder,
    dir,
    files: Object.keys(files),
    warnings,
    previewStructure: renderTree(folder, Object.keys(files)),
  };
}
