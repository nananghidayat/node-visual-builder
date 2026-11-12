// Helper bersama untuk template: sintaks modul, penamaan, versi dependency

export const moduleSyntax = (system) =>
  system === 'esm'
    ? {
        sideEffect: (from) => `import '${from}';`,
        def: (name, from) => `import ${name} from '${from}';`,
        named: (names, from) => `import { ${names.join(', ')} } from '${from}';`,
        exportDefault: (name) => `export default ${name};`,
        exportNamed: (names) => `export { ${names.join(', ')} };`,
      }
    : {
        sideEffect: (from) => (from === 'dotenv/config' ? `require('dotenv').config();` : `require('${from}');`),
        def: (name, from) => `const ${name} = require('${from}');`,
        named: (names, from) => `const { ${names.join(', ')} } = require('${from}');`,
        exportDefault: (name) => `module.exports = ${name};`,
        exportNamed: (names) => `module.exports = { ${names.join(', ')} };`,
      };

// resource = segmen URL & nama file (boleh '-'); tabel SQL & identifier JS diturunkan darinya
export const toTable = (resource) => resource.replace(/-/g, '_');
export const toIdentifier = (name) => name.replace(/[-_]+(\w)/g, (_, c) => c.toUpperCase());
export const toPascal = (name) => toIdentifier(name).replace(/^\w/, (c) => c.toUpperCase());

export const DEP_VERSIONS = {
  express: '^4.21.2',
  cors: '^2.8.5',
  helmet: '^8.0.0',
  morgan: '^1.10.0',
  dotenv: '^16.4.7',
  jsonwebtoken: '^9.0.2',
  mongoose: '^8.9.0',
  pg: '^8.13.1',
  mysql2: '^3.12.0',
  nodemon: '^3.1.9',
};

export const DB_PACKAGE = { mongodb: 'mongoose', postgresql: 'pg', mysql: 'mysql2' };
export const DB_LABEL = { mongodb: 'MongoDB', postgresql: 'PostgreSQL', mysql: 'MySQL' };

export const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
export const AUTH_LABEL = { none: 'Publik', apiKey: 'API Key', jwt: 'JWT Bearer' };

export const apiBase = (s) => (s.apiPrefix === '/' ? '' : s.apiPrefix);
export const fullPath = (s, ep) => `${apiBase(s)}/${ep.resource}${ep.routePath === '/' ? '' : ep.routePath}`;

// Slug dari nama proyek: dipakai untuk nama image Docker & default nama database
export const slugOf = (s) => s.name.replace(/^@[^/]+\//, '').replace(/[^a-z0-9_]/g, '_');
// Nama database: dari node Database kalau diisi, kalau tidak pakai slug nama proyek
export const dbNameOf = (s) => s.databaseName || slugOf(s);
