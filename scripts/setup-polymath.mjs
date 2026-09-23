import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [bundleArg, targetArg] = process.argv.slice(2);
if (!bundleArg || !targetArg) throw new Error('Usage: setup-polymath.mjs <bundle> <project>');
const bundle = fs.realpathSync(bundleArg);
const target = fs.realpathSync(targetArg);
const library = path.join(target, 'skills/cc-polymath');
const guide = fs.readFileSync(fileURLToPath(new URL('./hackathon-guide.md', import.meta.url)));
const names = fs.readdirSync(path.join(bundle, 'skills')).filter(name =>
  fs.existsSync(path.join(bundle, 'skills', name, 'SKILL.md'))).sort();
if (names.length !== 26) throw new Error('Incomplete cc-polymath bundle: expected 26 entry points');
const exists = p => { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } };

// Never overwrite a team's existing skill or edited library.
function checkTree(source, destination) {
  if (exists(destination)) {
    const info = fs.lstatSync(destination);
    if (info.isSymbolicLink()) throw new Error(`Refusing to overwrite symlink: ${destination}`);
    if (fs.statSync(source).isDirectory()) {
      if (!info.isDirectory()) throw new Error(`Conflicting destination: ${destination}`);
    } else if (!info.isFile() || !fs.readFileSync(source).equals(fs.readFileSync(destination))) {
      throw new Error(`Existing file differs; preserve or move it first: ${destination}`);
    }
  }
  if (fs.statSync(source).isDirectory())
    for (const entry of fs.readdirSync(source)) checkTree(path.join(source, entry), path.join(destination, entry));
}
if (bundle !== library) checkTree(bundle, library);
const legacyLinks = [];
const guides = [];
for (const agentDir of ['.agents/skills', '.claude/skills']) {
  const skillDir = path.join(target, agentDir, 'hackathon-guide');
  if (exists(skillDir) && (!fs.lstatSync(skillDir).isDirectory() || fs.lstatSync(skillDir).isSymbolicLink()))
    throw new Error(`Conflicting skill directory: ${skillDir}`);
  const file = path.join(skillDir, 'SKILL.md');
  if (exists(file) && (fs.lstatSync(file).isSymbolicLink() || !fs.readFileSync(file).equals(guide)))
    throw new Error(`Existing guide differs: ${file}`);
  guides.push(file);
  // Upgrade only links created by the earlier installer; unrelated skills stay intact.
  for (const name of names) {
    const link = path.join(target, agentDir, name);
    const old = path.join(target, '.agents/skill-library/cc-polymath/skills', name);
    if (exists(link) && fs.lstatSync(link).isSymbolicLink() && path.resolve(path.dirname(link), fs.readlinkSync(link)) === old)
      legacyLinks.push(link);
  }
}
if (bundle !== library) {
  fs.mkdirSync(path.dirname(library), { recursive: true });
  fs.cpSync(bundle, library, { recursive: true, force: false });
}
for (const file of guides) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, guide);
}
for (const link of legacyLinks) fs.unlinkSync(link);
console.log('Ready: one hackathon-guide per agent; all 26 cc-polymath skills are available on demand.');
console.log('Commit skills/cc-polymath/, .agents/skills/ and .claude/skills/. No symlinks or network required.');
