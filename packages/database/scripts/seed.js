import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.join(__dirname, '..', 'seeds');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/career_intelligence';

async function readJson(fileName) {
  try {
    return JSON.parse(await readFile(path.join(SEEDS_DIR, fileName), 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function upsertMany(collection, docs, keyFields) {
  if (!docs || docs.length === 0) return 0;
  for (const doc of docs) {
    const normalized = { ...doc };
    if (normalized.id) normalized._id = normalized.id;
    const query = Object.fromEntries(keyFields.map((k) => [k, normalized[k]]));
    const filter = normalized._id ? { _id: normalized._id } : query;
    await collection.updateOne(filter, { $set: normalized }, { upsert: true });
  }
  return docs.length;
}

/**
 * Derives per-role, per-skill baseline requirements from the curated
 * ontology. Skills earlier in a competency carry higher baseline level;
 * weights are allocated across a role's skills so they sum to 1.
 */
function deriveRoleRequirements(roles, competencies) {
  const requirements = [];
  for (const role of roles) {
    const roleComps = role.competencyIds
      .map((id) => competencies.find((c) => c.id === id))
      .filter(Boolean);

    const levelOrder = ['critical', 'required', 'preferred', 'optional'];
    const entries = [];

    for (const comp of roleComps) {
      const perComp = comp.skillIds.length || 1;
      comp.skillIds.forEach((skillId, i) => {
        const src = {
          id: `req-${role.id}-${skillId}`,
          roleId: role.id,
          competencyId: comp.id,
          skillId,
          baselineLevel: null,
          weight: 0,
          source: 'curated',
        };
        // First skill positions within each competency are the most critical.
        src.baselineLevel = levelOrder[Math.min(i, levelOrder.length - 1)] ?? 'optional';
        entries.push(src);
      });
      void perComp;
    }

    const total = entries.reduce((sum, e) => sum + (simpleRank(e.baselineLevel) ?? 0), 0) || 1;
    for (const e of entries) {
      e.baselineLevel = e.baselineLevel; // keep curated ordering (curators refine later)
      e.weight = Number(((simpleRank(e.baselineLevel) ?? 0) / total).toFixed(4));
    }
    requirements.push(...entries);
  }
  return requirements;
}

function simpleRank(level) {
  return { critical: 1, required: 0.75, preferred: 0.5, optional: 0.25 }[level] ?? 0.25;
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log(`Connected to ${uri}`);

  const skills = await readJson('skills.json');
  const aliases = await readJson('skillAliases.json');
  const competencies = await readJson('competencies.json');
  const roles = await readJson('roles.json');
  const explicitRequirements = await readJson('roleRequirements.json');

  const db = client.db();
  let total = 0;

  for (const name of ['skills', 'skillAliases', 'competencies', 'roles', 'roleRequirements']) {
    await db.collection(name).deleteMany({});
  }

  total += await upsertMany(db.collection('skills'), skills, ['id']);
  total += await upsertMany(db.collection('skillAliases'), aliases, ['alias']);
  total += await upsertMany(db.collection('competencies'), competencies, ['id']);
  total += await upsertMany(db.collection('roles'), roles, ['slug']);

  const requirements = explicitRequirements ?? deriveRoleRequirements(roles, competencies);
  total += await upsertMany(db.collection('roleRequirements'), requirements, ['id']);

  console.log(`Seed complete. ${total} documents upserted.`);
  await client.close();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});