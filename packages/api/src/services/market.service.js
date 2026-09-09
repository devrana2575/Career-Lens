import { MarketSnapshot } from '../models/marketSnapshot.model.js';
import { Skill } from '../models/skill.model.js';
import { Role } from '../models/role.model.js';

/**
 * Market intelligence read model (Phase 8).
 *
 * All views are computed from the append-only `marketSnapshots` written by
 * the data-service pipeline. Nothing is fabricated: volumes, confidence and
 * trend labels are derived from real snapshot counts, and low-volume cases
 * are surfaced as `insufficient` rather than guessed.
 */

const MIN_SUFFICIENT_VOLUME = 5;
const DEMAND_GROWTH = 0.2;
const SHARE_DELTA = 0.1;

export const DEFAULT_MIN_VOLUME = MIN_SUFFICIENT_VOLUME;

function demandLabel(volumeSeries) {
  if (volumeSeries.length < 2) return 'insufficient';
  const latest = volumeSeries[volumeSeries.length - 1];
  const previous = volumeSeries[volumeSeries.length - 2];
  if (latest > previous * (1 + DEMAND_GROWTH)) return 'rising';
  if (latest < previous * (1 - DEMAND_GROWTH)) return 'declining';
  return 'stable';
}

function trendLabel(shareSeries) {
  if (shareSeries.length < 2) return 'insufficient';
  const latest = shareSeries[shareSeries.length - 1];
  const previous = shareSeries[shareSeries.length - 2];
  if (latest >= previous + SHARE_DELTA) return 'rising';
  if (latest <= previous - SHARE_DELTA) return 'declining';
  return 'stable';
}

async function skillNamesByIds(ids) {
  const skills = await Skill.find({ _id: { $in: ids } }, { name: 1 }).lean();
  return new Map(skills.map((s) => [String(s._id), s.name]));
}

async function roleMap() {
  const roles = await Role.find({}, { name: 1, slug: 1 }).lean();
  return new Map(roles.map((r) => [String(r._id), r]));
}

function aggregatedExperience(snapshots) {
  let totalExp = 0;
  let totalJobs = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const s of snapshots) {
    const e = s.experienceYears;
    if (!e || e.avg == null) continue;
    const jobs = s.jobCount || 0;
    totalExp += e.avg * jobs;
    totalJobs += jobs;
    if (e.min != null) min = Math.min(min, e.min);
    if (e.max != null) max = Math.max(max, e.max);
  }
  if (totalJobs === 0) return { min: null, avg: null, max: null };
  return {
    min: min === Infinity ? null : min,
    avg: Number((totalExp / totalJobs).toFixed(1)),
    max: max === -Infinity ? null : max,
  };
}

function volumeSeriesByDate(roleSnapshots) {
  const byDate = new Map();
  for (const s of roleSnapshots) {
    byDate.set(s.snapshotDate, (byDate.get(s.snapshotDate) || 0) + (s.jobCount || 0));
  }
  return [...byDate.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((date) => byDate.get(date));
}

function filteredByDate(sorted, date) {
  return sorted.filter((s) => s.snapshotDate === date);
}

async function buildRoleBenchmark(roleId, roleSnapshots, namesById, role) {
  const sorted = [...roleSnapshots].sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate));
  const latestDate = sorted.length ? sorted[sorted.length - 1].snapshotDate : null;
  const latest = filteredByDate(sorted, latestDate);
  const jobVolume = latest.reduce((sum, s) => sum + (s.jobCount || 0), 0);

  const skillTotals = new Map();
  for (const s of latest) {
    for (const f of s.skillFrequencies || []) {
      skillTotals.set(f.skillId, (skillTotals.get(f.skillId) || 0) + (f.count || 0));
    }
  }
  const topSkills = [...skillTotals.entries()]
    .sort(([aId, aCount], [bId, bCount]) => bCount - aCount || aId.localeCompare(bId))
    .slice(0, 10)
    .map(([skillId, count]) => ({
      skillId,
      skillName: namesById.get(skillId) ?? 'Unknown skill',
      count,
      share: jobVolume ? Number((count / jobVolume).toFixed(3)) : 0,
    }));

  const locations = latest
    .map((s) => ({ location: s.location, jobCount: s.jobCount || 0 }))
    .sort((a, b) => b.jobCount - a.jobCount);

  return {
    roleId: String(roleId),
    roleName: role?.name ?? String(roleId),
    roleSlug: role?.slug ?? String(roleId).replace(/^role-/, ''),
    snapshotDate: latestDate,
    jobVolume,
    dataVolume: `${jobVolume} postings`,
    confidence: jobVolume >= MIN_SUFFICIENT_VOLUME ? 'sufficient' : 'insufficient',
    demand: demandLabel(volumeSeriesByDate(sorted)),
    experienceYears: aggregatedExperience(latest),
    topSkills,
    locations,
  };
}

export async function getMarketOverview() {
  const all = await MarketSnapshot.find().sort({ snapshotDate: 1 }).lean();
  if (all.length === 0) {
    return {
      demoData: true,
      asOfDate: null,
      sources: [],
      totalSnapshots: 0,
      totalJobs: 0,
      rolesCovered: 0,
      locations: [],
    };
  }
  const asOfDate = all[all.length - 1].snapshotDate;
  const latest = all.filter((s) => s.snapshotDate === asOfDate);

  return {
    demoData: latest.every((s) => s.demoData === true),
    asOfDate,
    sources: [...new Set(all.map((s) => s.source))].sort(),
    totalSnapshots: all.length,
    totalJobs: latest.reduce((sum, s) => sum + (s.jobCount || 0), 0),
    rolesCovered: new Set(latest.map((s) => s.roleId)).size,
    locations: [...new Set(latest.map((s) => s.location))].sort(),
  };
}

export async function listRoleBenchmarks() {
  const snapshots = await MarketSnapshot.find().lean();
  const byRole = new Map();
  for (const s of snapshots) {
    const list = byRole.get(String(s.roleId)) ?? [];
    list.push(s);
    byRole.set(String(s.roleId), list);
  }
  const skillIds = new Set(
    snapshots.flatMap((s) => (s.skillFrequencies || []).map((f) => f.skillId)),
  );
  const [namesById, roles] = await Promise.all([skillNamesByIds([...skillIds]), roleMap()]);

  const benchmarks = [];
  for (const [roleId, roleSnapshots] of byRole) {
    benchmarks.push(await buildRoleBenchmark(roleId, roleSnapshots, namesById, roles.get(roleId)));
  }
  return benchmarks.sort((a, b) => a.roleName.localeCompare(b.roleName));
}

export async function getRoleBenchmark(roleIdOrSlug) {
  const roleSlug = String(roleIdOrSlug);
  const role =
    (await Role.findById(roleSlug).lean()) ??
    (await Role.findOne({ slug: roleSlug }).lean());
  if (!role) return null;
  const roleId = String(role._id);
  const roleSnapshots = await MarketSnapshot.find({ roleId }).lean();
  const skillIds = new Set(
    roleSnapshots.flatMap((s) => (s.skillFrequencies || []).map((f) => f.skillId)),
  );
  const namesById = await skillNamesByIds([...skillIds]);
  return buildRoleBenchmark(roleId, roleSnapshots, namesById, role);
}

export function skillTrend({ snapshots, skillId, namesById }) {
  const byDate = new Map();
  for (const s of snapshots) {
    const list = byDate.get(s.snapshotDate) ?? [];
    list.push(s);
    byDate.set(s.snapshotDate, list);
  }
  const series = [];
  for (const date of [...byDate.keys()].sort((a, b) => a.localeCompare(b))) {
    let mentions = 0;
    let jobs = 0;
    for (const s of byDate.get(date)) {
      const f = (s.skillFrequencies || []).find((entry) => entry.skillId === skillId);
      if (f) {
        mentions += f.count || 0;
        jobs += s.jobCount || 0;
      }
    }
    if (jobs === 0) continue;
    series.push({
      snapshotDate: date,
      mentions,
      jobs,
      share: Number((mentions / jobs).toFixed(3)),
    });
  }
  const latest = series[series.length - 1];
  const latestJobs = latest ? latest.jobs : 0;
  return {
    skillId: String(skillId),
    skillName: namesById.get(String(skillId)) ?? 'Unknown skill',
    trend: trendLabel(series.map((e) => e.share)),
    latestShare: latest ? latest.share : null,
    dataVolume: `${latestJobs} postings`,
    confidence: latestJobs >= MIN_SUFFICIENT_VOLUME ? 'sufficient' : 'insufficient',
    series,
  };
}

export async function listSkillTrends() {
  const snapshots = await MarketSnapshot.find().sort({ snapshotDate: 1 }).lean();
  const skillIds = new Set(
    snapshots.flatMap((s) => (s.skillFrequencies || []).map((f) => f.skillId)),
  );
  const namesById = await skillNamesByIds([...skillIds]);

  const trends = [...skillIds].map((skillId) => skillTrend({ snapshots, skillId, namesById }));
  return trends.sort(
    (a, b) => (b.latestShare ?? -1) - (a.latestShare ?? -1) || a.skillName.localeCompare(b.skillName),
  );
}

export async function getSkillTrend(skillId) {
  const skill = await Skill.findById(skillId).lean();
  if (!skill) return null;
  const snapshots = await MarketSnapshot.find().sort({ snapshotDate: 1 }).lean();
  const namesById = await skillNamesByIds([String(skill._id)]);
  return skillTrend({ snapshots, skillId: String(skill._id), namesById });
}