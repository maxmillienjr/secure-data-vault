#!/usr/bin/env node
/**
 * Structural lint for docs/prd, docs/adr and docs/STATUS.md.
 *
 * Prose drifts silently — this repository is the proof. The architecture diagram drew a
 * "KEK Unwrap" edge to Cloud KMS whose code path throws, an ADR consequence said the prod
 * loader existed, and three documents described a `finally` block that no source file
 * contains. Prose can't be checked mechanically, but structure can, and structure is where
 * drift shows up first: an id that resolves nowhere, a dependency that isn't mutual, a
 * status in the index that no longer matches the file, an evidence citation whose line
 * number is past the end of the file it names.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const prdDir = join(root, 'docs', 'prd');
const adrDir = join(root, 'docs', 'adr');

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const STATUSES = ['draft', 'accepted', 'in-progress', 'shipped', 'superseded'];
const SIZES = ['S', 'M', 'L'];
const REQUIRED = [
  'id',
  'title',
  'tier',
  'status',
  'size',
  'depends_on',
  'blocks',
  'issue',
  'superseded_by',
];
// docs/STATUS.md vocabulary. `unverified` is deliberate: a capability the matrix's author
// could not run is recorded as that, never promoted to `implemented` on the strength of
// reading it.
const MATRIX_STATUSES = ['implemented', 'stubbed', 'planned', 'broken', 'removed', 'unverified'];

/** Minimal frontmatter reader. Handles scalars and inline arrays, which is all we use. */
function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let raw = line.slice(idx + 1).trim();
    raw = raw.replace(/\s+#.*$/, '').trim();
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim();
      out[key] = inner ? inner.split(',').map((s) => s.trim()) : [];
    } else if (raw === 'null' || raw === '') {
      out[key] = null;
    } else {
      out[key] = raw;
    }
  }
  return out;
}

// --- PRD index is the registry of known ids -------------------------------
const prdIndexPath = join(prdDir, 'README.md');
if (!existsSync(prdIndexPath)) {
  fail('docs/prd/README.md', 'missing — the index is the source of truth for the backlog');
}
const prdIndex = new Map();
if (existsSync(prdIndexPath)) {
  for (const line of readFileSync(prdIndexPath, 'utf-8').split('\n')) {
    const row = /^\|\s*(?:\[([^\]]+)\]\([^)]+\)|([A-Z]\d-[A-Z]))\s*\|(.+)\|\s*$/.exec(line);
    if (!row) continue;
    const id = row[1] ?? row[2];
    const cells = row[3].split('|').map((c) => c.trim());
    prdIndex.set(id, { status: cells[cells.length - 1], size: cells[cells.length - 2] });
  }
  if (prdIndex.size === 0)
    fail('docs/prd/README.md', 'no PRD rows parsed from the index tables');
}

// --- Each PRD file -------------------------------------------------------
const files = existsSync(prdDir)
  ? readdirSync(prdDir).filter((f) => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')
  : [];
const byId = new Map();

for (const file of files) {
  const where = `docs/prd/${file}`;
  const body = readFileSync(join(prdDir, file), 'utf-8');
  const fm = frontmatter(body);
  if (!fm) {
    fail(where, 'no YAML frontmatter block');
    continue;
  }
  for (const key of REQUIRED) {
    if (!(key in fm)) fail(where, `frontmatter is missing \`${key}\``);
  }
  if (fm.status && !STATUSES.includes(fm.status))
    fail(where, `status \`${fm.status}\` is not one of ${STATUSES.join(', ')}`);
  if (fm.size && !SIZES.includes(fm.size))
    fail(where, `size \`${fm.size}\` is not one of ${SIZES.join(', ')}`);
  if (fm.id && !file.startsWith(`${fm.id}-`))
    fail(where, `filename does not start with its id \`${fm.id}\``);
  if (fm.id && !prdIndex.has(fm.id)) fail(where, `id \`${fm.id}\` is not listed in the index`);
  if (fm.id && prdIndex.has(fm.id)) {
    const row = prdIndex.get(fm.id);
    if (row.status !== fm.status)
      fail(where, `status \`${fm.status}\` disagrees with the index, which says \`${row.status}\``);
    if (row.size !== fm.size)
      fail(where, `size \`${fm.size}\` disagrees with the index, which says \`${row.size}\``);
  }
  if (fm.status === 'in-progress' && !fm.issue)
    fail(where, 'status is `in-progress` but no issue is recorded');
  if (fm.status === 'superseded' && !fm.superseded_by)
    fail(where, 'status is `superseded` but `superseded_by` is empty');

  // A shipped PRD may still carry unmet criteria — but each one must name the PRD that
  // now owns it. The naive rule (shipped implies zero unchecked boxes) is worse than
  // useless: it pressures the author to tick a box and append a caveat, which is exactly
  // how `shipped` stops meaning anything.
  if (fm.status === 'shipped') {
    const section = /## Acceptance criteria\n([\s\S]*?)(?=\n## )/.exec(body);
    if (section) {
      for (const item of section[1].split(/\n(?=- \[)/)) {
        if (!item.trim().startsWith('- [ ]')) continue;
        if (!/\bP\d-[A-Z]\b/.test(item))
          fail(
            where,
            'is shipped with an unmet criterion that names no owning PRD: ' +
              `"${item.replace(/\s+/g, ' ').slice(6, 76).trim()}…"`,
          );
      }
    }
  }
  if (fm.id) byId.set(fm.id, { fm, where });
}

// --- Referential integrity ------------------------------------------------
for (const [id, { fm, where }] of byId) {
  for (const key of ['depends_on', 'blocks']) {
    for (const ref of fm[key] ?? []) {
      if (!prdIndex.has(ref))
        fail(where, `${key} references \`${ref}\`, which is not in the index`);
    }
  }
  // Symmetry, checkable only where both files exist.
  for (const ref of fm.blocks ?? []) {
    const other = byId.get(ref);
    if (other && !(other.fm.depends_on ?? []).includes(id))
      fail(where, `blocks \`${ref}\`, but ${ref} does not list \`${id}\` in depends_on`);
  }
  for (const ref of fm.depends_on ?? []) {
    const other = byId.get(ref);
    if (other && !(other.fm.blocks ?? []).includes(id))
      fail(where, `depends_on \`${ref}\`, but ${ref} does not list \`${id}\` in blocks`);
  }
  if (fm.superseded_by && !prdIndex.has(fm.superseded_by))
    fail(where, `superseded_by references \`${fm.superseded_by}\`, which is not in the index`);
}

// --- ADRs -----------------------------------------------------------------
const adrIndexPath = join(adrDir, 'README.md');
if (existsSync(adrIndexPath)) {
  const indexed = new Set();
  for (const line of readFileSync(adrIndexPath, 'utf-8').split('\n')) {
    const row = /^\|\s*\[(\d{4})\]\(([^)]+)\)\s*\|/.exec(line);
    if (!row) continue;
    indexed.add(row[2]);
    if (!existsSync(join(adrDir, row[2])))
      fail('docs/adr/README.md', `index lists \`${row[2]}\`, which does not exist`);
  }
  for (const file of readdirSync(adrDir).filter((f) => /^\d{4}-.*\.md$/.test(f))) {
    if (!indexed.has(file)) fail(`docs/adr/${file}`, 'exists but is not listed in the ADR index');
    const text = readFileSync(join(adrDir, file), 'utf-8');
    if (!/^\*\*Status:\*\*\s*(\S+)/m.test(text))
      fail(`docs/adr/${file}`, 'has no **Status:** line');
  }
} else {
  fail('docs/adr/README.md', 'missing');
}

// --- docs/STATUS.md -------------------------------------------------------
// Every row cites a `path:NN`. Those citations are the whole value of the matrix, and
// they rot silently when a file is renamed or shrinks. Resolve each one against the
// tracked tree and range-check the line, so a stale citation fails the build instead of
// misleading a reader. Extensionless `Dockerfile` and the .tf/.sh/.conf/.md surfaces this
// repo cites are included alongside the source extensions.
//
// The line spec is a comma-separated list of lines and ranges — `decrypt.ts:63,67`,
// `app.module.ts:20-25,36`, `Dockerfile:2,27` — because that is the form the matrix
// actually uses for a claim that rests on two places in one file. An earlier regex here
// matched only a single line or range, so every comma form escaped the check entirely:
// `decrypt.ts:63,99999` passed. Each segment is resolved and range-checked on its own.
const statusPath = join(root, 'docs', 'STATUS.md');
if (existsSync(statusPath)) {
  const statusText = readFileSync(statusPath, 'utf-8');
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf-8' })
    .split('\n')
    .filter(Boolean);
  const seen = new Set();
  const refs = statusText.matchAll(
    /`([A-Za-z0-9._/-]+(?:\.(?:ts|tsx|mjs|js|yml|yaml|json|tf|hcl|sh|conf|toml|md)|Dockerfile)):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)`/g,
  );
  for (const [, relPath, lineSpec] of refs) {
    const key = `${relPath}:${lineSpec}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // An exact path wins outright; otherwise a unique basename or path suffix resolves.
    // `README.md` must resolve to the root file even though crypto-core has one too.
    const exact = tracked.find((f) => f === relPath);
    const matches = exact ? [exact] : tracked.filter((f) => f.endsWith(`/${relPath}`));
    if (matches.length === 0) {
      fail('docs/STATUS.md', `cites \`${relPath}\`, which no tracked file matches`);
      continue;
    }
    if (matches.length > 1) {
      fail(
        'docs/STATUS.md',
        `cites \`${relPath}\`, which is ambiguous (${matches.length} matches: ${matches.join(', ')})`,
      );
      continue;
    }
    const lines = readFileSync(join(root, matches[0]), 'utf-8').split('\n').length;
    for (const segment of lineSpec.split(',')) {
      const [startStr, endStr] = segment.split('-');
      if (endStr !== undefined && Number(endStr) < Number(startStr)) {
        fail('docs/STATUS.md', `cites \`${relPath}:${segment}\`, whose range runs backwards`);
        continue;
      }
      const last = Number(endStr ?? startStr);
      if (last > lines)
        fail(
          'docs/STATUS.md',
          `cites \`${relPath}:${segment}\` but ${matches[0]} has ${lines} lines`,
        );
    }
  }

  // The status column uses a closed vocabulary, and the legend table defines it. A row
  // that invents a value ("mostly", "partial") is how the matrix stops being readable at
  // a glance.
  let matrixRows = 0;
  for (const line of statusText.split('\n')) {
    const row = /^\|\s*(\d+)\s*\|[^|]*\|\s*`([^`]+)`\s*\|/.exec(line);
    if (!row) continue;
    matrixRows += 1;
    if (!MATRIX_STATUSES.includes(row[2]))
      fail(
        'docs/STATUS.md',
        `row ${row[1]} has status \`${row[2]}\`, which is not one of ${MATRIX_STATUSES.join(', ')}`,
      );
  }
  if (matrixRows === 0) fail('docs/STATUS.md', 'no matrix rows parsed');
}

// --- Node major ------------------------------------------------------------
// Deliberately absent. The sibling of this script checks that README, workflows and
// Dockerfiles agree on one Node major, but here they do not: the four workflows and the
// console image say 24, and apps/vault-api/Dockerfile has said 26 since a Dependabot
// base-image bump (dac184d). Porting the check would fail every build until someone picks
// a major, and picking one is a runtime decision, not a docs-lint decision. It is
// docs/STATUS.md row 32 and a P0-A acceptance criterion; when that row closes, add the
// check back (read the major off `node-version:` in each workflow, `FROM node:NN` in each
// Dockerfile, and `Node.js NN` in README.md, and fail when they differ).

// --- Report ---------------------------------------------------------------
if (errors.length) {
  console.error(`\ndocs lint failed with ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log(
  `docs lint passed: ${byId.size} PRD file(s), ${prdIndex.size} indexed, ADR index consistent, STATUS citations resolve.`,
);
