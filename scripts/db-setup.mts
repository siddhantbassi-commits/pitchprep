// Creates (or finds) the Supabase project, applies supabase/schema.sql, and writes the keys into .env.local.
// 
//        npm run db:setup -- --create -> create the project if missing, then apply schema
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const API = 'https://api.supabase.com/v1';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN is empty in .env.local'); process.exit(1); }
const create = process.argv.includes('--create');
const NAME = 'pitchprep';

async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const text = await r.text();
  let body: any = text; try { body = JSON.parse(text); } catch { /* keep text */ }
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${r.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

const orgs = await call('/organizations');
const projects = await call('/projects');
console.log('ORGS', orgs.map((o: any) => ({ id: o.id, name: o.name, slug: o.slug })));
console.log('PROJECTS', projects.map((p: any) => ({ ref: p.id ?? p.ref, name: p.name, region: p.region, status: p.status, org: p.organization_slug ?? p.organization_id })));

const refArg = process.argv.find((a) => a.startsWith('--ref='))?.slice(6);
let project = refArg ? { id: refArg } : projects.find((p: any) => p.name === NAME);
if (!project) {
  if (!create) { console.log(`\nNo project named "${NAME}" yet. Re-run with --create to make one.`); process.exit(0); }
  const org = orgs[0] ?? { id: projects[0]?.organization_id, name: projects[0]?.organization_slug };
  console.log(`Creating project "${NAME}" in org ${org.name} (ap-south-1)...`);
  project = await call('/projects', {
    method: 'POST',
    body: JSON.stringify({ name: NAME, organization_id: org.id ?? org.slug, db_pass: randomBytes(18).toString('base64url'), region: 'ap-south-1' }),
  });
}
const ref = project.id ?? project.ref;
for (let i = 0; i < 60; i++) {
  const p = await call(`/projects/${ref}`);
  if (String(p.status).includes('ACTIVE')) break;
  if (i === 59) throw new Error(`project not healthy: ${p.status}`);
  process.stdout.write('.'); await new Promise((r) => setTimeout(r, 5000));
}
console.log(`\nProject ${ref} is up.`);

console.log('Applying schema...');
await call(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query: readFileSync('supabase/schema.sql', 'utf8') }) });

const keys = await call(`/projects/${ref}/api-keys?reveal=true`);
const service = keys.find((k: any) => k.name === 'service_role') ?? keys.find((k: any) => k.type === 'secret');
const anon = keys.find((k: any) => k.name === 'anon') ?? keys.find((k: any) => k.type === 'publishable');
if (!service || !anon) throw new Error('could not read api keys');

let env = readFileSync('.env.local', 'utf8');
const set = (k: string, v: string) => { env = env.match(new RegExp(`^${k}=.*$`, 'm')) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`) : env + `\n${k}=${v}`; };
const url = `https://${ref}.supabase.co`;
set('SUPABASE_URL', url); set('NEXT_PUBLIC_SUPABASE_URL', url);
set('SUPABASE_SERVICE_ROLE_KEY', service.api_key); set('NEXT_PUBLIC_SUPABASE_ANON_KEY', anon.api_key);
set('SUPABASE_PROJECT_REF', ref);
writeFileSync('.env.local', env, { mode: 0o600 });
console.log('Keys written to .env.local. Done.');
