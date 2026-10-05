const org = process.env.ORG || process.env.GITHUB_REPOSITORY_OWNER || 'Noronica';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error('GH_TOKEN/GITHUB_TOKEN is required');

async function api(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Noronica-Profile-Updater'
    }
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json();
}

const repos = [];
for (let page = 1; page <= 10; page++) {
  const batch = await api(`https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=100&page=${page}&type=all&sort=updated`);
  repos.push(...batch);
  if (batch.length < 100) break;
}

const publicRepos = repos.filter(r => !r.private && !r.archived && !r.fork);
const featured = [...publicRepos]
  .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
  .slice(0, 6);

const totalStars = publicRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
const totalForks = publicRepos.reduce((sum, r) => sum + r.forks_count, 0);
const now = new Date().toISOString().slice(0, 10);

const snapshot = `**Live snapshot · ${now}:** ${publicRepos.length} public ${publicRepos.length === 1 ? 'repository' : 'repositories'} · ${totalStars} ${totalStars === 1 ? 'star' : 'stars'} · ${totalForks} ${totalForks === 1 ? 'fork' : 'forks'}\n`;

let projects;
if (featured.length === 0) {
  projects = `#### Selected public work\n\nOur public projects will appear here automatically as they are published under the Noronica organization.\n`;
} else {
  const rows = featured.map(r => {
    const lang = r.language ? ` · ${r.language}` : '';
    const desc = (r.description || 'No description yet.').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return `| [**${r.name}**](${r.html_url}) | ${desc} | ${r.stargazers_count} ⭐${lang} |`;
  }).join('\n');
  projects = `#### Selected public work\n\nAutomatically ranked from Noronica's active public repositories.\n\n| Repository | What it is | Signal |\n| --- | --- | ---: |\n${rows}\n`;
}

const fs = await import('node:fs/promises');
const path = '.github/profile/README.md';
let readme = await fs.readFile(path, 'utf8');
readme = readme.replace(/<!-- NORONICA:SNAPSHOT:START -->[\s\S]*?<!-- NORONICA:SNAPSHOT:END -->/, `<!-- NORONICA:SNAPSHOT:START -->\n${snapshot}<!-- NORONICA:SNAPSHOT:END -->`);
readme = readme.replace(/<!-- NORONICA:PROJECTS:START -->[\s\S]*?<!-- NORONICA:PROJECTS:END -->/, `<!-- NORONICA:PROJECTS:START -->\n${projects}<!-- NORONICA:PROJECTS:END -->`);
await fs.writeFile(path, readme);
