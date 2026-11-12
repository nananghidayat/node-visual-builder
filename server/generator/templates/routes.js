// Template file router per resource
import { moduleSyntax } from '../syntax.js';

const AUTH_MIDDLEWARE = { apiKey: 'requireApiKey', jwt: 'requireJwt' };

// Skema validasi yang diteruskan ke middleware validate(); null kalau endpoint tidak butuh validasi
export function validationSchema(ep, idKind) {
  const schema = {};
  if (ep.pathParams.length) schema.params = ep.pathParams.map(({ name, type }) => ({ name, type }));
  if (ep.queryParams.length) schema.query = ep.queryParams;
  if (ep.body) schema.body = ep.body;
  if (ep.pathParams.some((p) => p.type === 'id')) schema.idKind = idKind;
  return Object.keys(schema).length ? schema : null;
}

// Literal JS ringkas: tiap item array satu baris, mis. { name: 'id', type: 'id' }
const inline = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? `{ ${Object.entries(value).map(([k, v]) => `${k}: ${inline(v)}`).join(', ')} }`
    : Array.isArray(value)
      ? `[${value.map(inline).join(', ')}]`
      : typeof value === 'string'
        ? `'${value}'`
        : String(value);

function schemaLiteral(schema, pad) {
  const lines = Object.entries(schema).map(([key, value]) => {
    if (Array.isArray(value) && value.length) {
      return `${pad}  ${key}: [\n${value.map((item) => `${pad}    ${inline(item)},`).join('\n')}\n${pad}  ],`;
    }
    if (key === 'body' && value.fields) {
      return `${pad}  body: {\n${pad}    partial: ${value.partial},\n${pad}    fields: [\n${value.fields.map((f) => `${pad}      ${inline(f)},`).join('\n')}\n${pad}    ],\n${pad}  },`;
    }
    return `${pad}  ${key}: ${inline(value)},`;
  });
  return `{\n${lines.join('\n')}\n${pad}}`;
}

export function routeJs(s, resource, { endpoints, usesDb }) {
  const m = moduleSyntax(s.moduleSystem);
  const idKind = usesDb && s.database === 'mongodb' ? 'objectId' : 'int';

  const schemas = endpoints.map((ep) => [ep, validationSchema(ep, idKind)]);
  const authUsed = [...new Set(endpoints.map((ep) => AUTH_MIDDLEWARE[ep.auth]).filter(Boolean))];
  const needsValidate = schemas.some(([, schema]) => schema);

  const L = [m.def('express', 'express')];
  if (authUsed.length) L.push(m.named(authUsed, '../middleware/auth.js'));
  if (needsValidate) L.push(m.named(['validate'], '../middleware/validate.js'));
  L.push(m.named(endpoints.map((ep) => ep.handler), `../controllers/${resource}Controller.js`), '');

  if (needsValidate) {
    L.push('const schemas = {');
    for (const [ep, schema] of schemas) {
      if (schema) L.push(`  ${ep.handler}: ${schemaLiteral(schema, '  ')},`);
    }
    L.push('};', '');
  }

  L.push('const router = express.Router();', '');
  for (const [ep, schema] of schemas) {
    const chain = [
      `'${ep.routePath}'`,
      ...(AUTH_MIDDLEWARE[ep.auth] ? [AUTH_MIDDLEWARE[ep.auth]] : []),
      ...(schema ? [`validate(schemas.${ep.handler})`] : []),
      ep.handler,
    ];
    L.push(`router.${ep.method.toLowerCase()}(${chain.join(', ')});`);
  }
  L.push('', m.exportDefault('router'), '');
  return L.join('\n');
}
