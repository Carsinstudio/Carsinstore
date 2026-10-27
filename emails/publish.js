// Creates or updates email templates in Resend from emails/dist, then publishes them.
//   node emails/build.js && node emails/publish.js review-request      (one template)
//   node emails/build.js && node emails/publish.js                     (all of them)
// Needs the Resend CLI signed in with a full-access key: npx resend-cli@latest login
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dist = path.join(__dirname, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.json'), 'utf8'));
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest);

// shell:true so Windows finds npx; every argument is quoted.
const cli = args => {
  const r = spawnSync('npx', ['--yes', 'resend-cli@latest', ...args, '--json'].map(a => JSON.stringify(a)), { shell: true, encoding: 'utf8' });
  let out = {}; try { out = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); } catch {}
  return { ok: r.status === 0 && !out.error, out, raw: (r.stdout + r.stderr).trim() };
};

for (const alias of wanted) {
  const t = manifest[alias];
  if (!t) { console.error(`No template "${alias}" in emails/dist. Run node emails/build.js first.`); process.exitCode = 1; continue; }
  const body = ['--name', t.name, '--subject', t.subject, '--html-file', path.join(dist, `${alias}.html`), '--text-file', path.join(dist, `${alias}.txt`),
    ...t.vars.flatMap(v => ['--var', v])];
  const exists = cli(['templates', 'get', alias]).ok;
  const saved = exists ? cli(['templates', 'update', alias, ...body]) : cli(['templates', 'create', '--alias', alias, ...body]);
  if (!saved.ok) { console.error(`${alias}: ${exists ? 'update' : 'create'} failed\n${saved.raw}`); process.exitCode = 1; continue; }
  const pub = cli(['templates', 'publish', alias]);
  console.log(pub.ok ? `${alias}: ${exists ? 'updated' : 'created'} and published` : `${alias}: saved but publish failed\n${pub.raw}`);
  if (!pub.ok) process.exitCode = 1;
}
