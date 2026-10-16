#!/usr/bin/env node
/**
 * Smoke test for a running deployment. Read-only: it sends GET requests only, submits no
 * form and signs in nowhere. It checks what can be checked without an account; the rest is
 * the manual checklist in docs/VERIFICATION_CHECKLIST.md.
 *
 *   npm run smoke -- https://your-deployment.example
 *   npm run smoke -- http://localhost:3000 --expect-indexable   # only once indexing is intended
 */
const base = (process.argv[2] ?? '').replace(/\/+$/, '');
const expectIndexable = process.argv.includes('--expect-indexable');
if (!/^https?:\/\//.test(base)) {
  console.error('Usage: npm run smoke -- <base URL> [--expect-indexable]');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
};
const get = async (path) => {
  const response = await fetch(base + path, { redirect: 'manual', headers: { 'user-agent': 'gnj-smoke-test' } });
  const body = response.status >= 300 && response.status < 400 ? '' : await response.text();
  return { status: response.status, headers: response.headers, body, location: response.headers.get('location') ?? '' };
};
const noindexHeader = (r) => /noindex/i.test(r.headers.get('x-robots-tag') ?? '');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

try {
  // ---- Public pages ----------------------------------------------------------------------
  const home = await get('/');
  check('home loads', home.status === 200 && home.body.includes('Gabay ni Juan'), `status ${home.status}`);
  check('home states neutrality', /does not endorse, rank, score, or recommend/.test(text(home.body)));
  check('no privileged key in the page', !/service_role|sb_secret_/.test(home.body));

  for (const path of ['/verification', '/methodology']) {
    const page = await get(path);
    check(`${path} loads`, page.status === 200, `status ${page.status}`);
  }

  const directory = await get('/politicians');
  const slugs = [...new Set([...directory.body.matchAll(/href="\/politicians\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
  check('directory loads and lists people', directory.status === 200 && slugs.length > 0, `status ${directory.status}, ${slugs.length} people`);
  check('directory says order is not ranking', /Order does not imply ranking/.test(text(directory.body)));

  const empty = await get('/politicians?q=zzzzqqqq');
  check('search with no match explains itself neutrally', empty.status === 200 && /No politicians match this search/.test(text(empty.body)));

  const filtered = await get('/politicians?level=national');
  check('filter by office level works', filtered.status === 200 && /Office level: National/.test(text(filtered.body)), `status ${filtered.status}`);

  const beyond = await get('/politicians?page=999');
  check('a page past the end returns to page 1', beyond.status >= 300 && beyond.status < 400 && /\/politicians$/.test(beyond.location), `status ${beyond.status} -> ${beyond.location}`);

  let claimPath;
  if (slugs.length > 0) {
    const profile = await get(`/politicians/${slugs[0]}`);
    check(`profile /politicians/${slugs[0]} loads`, profile.status === 200, `status ${profile.status}`);
    check('profile has a slug canonical URL', new RegExp(`rel="canonical" href="[^"]*/politicians/${slugs[0]}"`).test(profile.body));
    for (const section of ['Election Participation', 'Public Office History', 'Political Affiliations', 'Education', 'Policy Positions', 'Sources']) {
      if (!profile.body.includes(section)) check(`profile shows section "${section}"`, false);
    }
    check('profile offers "Report an error"', /href="\/corrections\/report\?type=person/.test(profile.body));
    claimPath = /href="(\/claims\/[^"]+)"/.exec(profile.body)?.[1];
    check('profile links a claim to its evidence', Boolean(claimPath));
  }

  if (claimPath) {
    const claim = await get(claimPath);
    check(`claim ${claimPath} loads`, claim.status === 200 && /Verification status/.test(text(claim.body)), `status ${claim.status}`);
    const external = [...claim.body.matchAll(/<a href="https?:\/\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    check('claim shows at least one source link', external.length > 0);
    check('source links open safely (noopener noreferrer)', external.every((a) => /rel="[^"]*noopener[^"]*noreferrer/.test(a)), `${external.length} links`);
  }

  // Elections (Milestone 5): index -> election -> office, readable filter links.
  const elections = await get('/elections');
  const electionPaths = [...elections.body.matchAll(/href="(\/elections\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  check('elections index loads and lists elections', elections.status === 200 && electionPaths.length > 0, `status ${elections.status}, ${electionPaths.length} elections`);
  check('elections index says order is not ranking', /Order does not imply importance or ranking/.test(text(elections.body)));
  if (electionPaths[0]) {
    const election = await get(electionPaths[0]);
    check(`election ${electionPaths[0]} loads with a slug canonical URL`, election.status === 200 && new RegExp(`rel="canonical" href="[^"]*${electionPaths[0]}"`).test(election.body), `status ${election.status}`);
    check('election page has Event structured data', /"@type":"Event"/.test(election.body));
    const officePath = [...election.body.matchAll(/href="(\/elections\/[a-z0-9-]+\/[a-z0-9-]+)"/g)].map((m) => m[1])[0];
    if (officePath) {
      const officePage = await get(officePath);
      check(`office page ${officePath} loads and explains candidacy`, officePage.status === 200 && /does not make someone an official candidate/.test(text(officePage.body)), `status ${officePage.status}`);
    } else {
      check('election page links to an office page', false);
    }
    const readable = await get(`/politicians?election=${electionPaths[0].split('/')[2]}`);
    check('directory accepts a readable election filter', readable.status === 200 && /Election: /.test(text(readable.body)), `status ${readable.status}`);
  }

  const report = await get('/corrections/report');
  check('report page without a target does not offer a form', report.status === 200 && /could not be started/.test(text(report.body)));

  for (const path of ['/this-page-does-not-exist', '/politicians/nobody-here-at-all', '/claims/not-a-claim', '/elections/no-such-election']) {
    const missing = await get(path);
    check(`${path} is a 404`, missing.status === 404, `status ${missing.status}`);
  }

  // ---- Indexing --------------------------------------------------------------------------
  const robots = await get('/robots.txt');
  const sitemap = await get('/sitemap.xml');
  if (expectIndexable) {
    check('robots.txt allows crawling but not /admin', /Disallow: \/admin/.test(robots.body) && !/Disallow: \/\s*$/m.test(robots.body));
    check('sitemap lists pages', /<loc>/.test(sitemap.body));
  } else {
    check('every public response carries X-Robots-Tag: noindex', [home, directory, robots, sitemap].every(noindexHeader));
    check('pages have noindex metadata', /<meta name="robots" content="noindex/.test(home.body));
    check('robots.txt disallows everything', /Disallow: \/\s*$/m.test(robots.body));
    check('sitemap is empty', sitemap.status === 200 && !/<loc>/.test(sitemap.body));
  }

  // ---- Editorial boundary (signed out) ---------------------------------------------------
  for (const path of ['/admin', '/admin/queue', '/admin/roles', '/admin/revisions', '/admin/corrections']) {
    const page = await get(path);
    check(`${path} redirects a signed-out visitor to sign-in`, page.status >= 300 && page.status < 400 && /\/admin\/login/.test(page.location), `status ${page.status} -> ${page.location}`);
  }
  const login = await get('/admin/login');
  check('/admin/login loads', login.status === 200 && /Editorial sign-in/.test(text(login.body)), `status ${login.status}`);
  check('/admin is never indexable or cached', noindexHeader(login) && /no-store/.test(login.headers.get('cache-control') ?? ''));
  check('sign-in page offers no sign-up', !/sign up|create account|register/i.test(text(login.body)));
} catch (error) {
  check('smoke test could reach the site', false, error instanceof Error ? error.message : String(error));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed against ${base}`);
process.exit(failed.length === 0 ? 0 : 1);
