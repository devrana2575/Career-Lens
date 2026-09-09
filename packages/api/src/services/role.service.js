import { Role } from '../models/role.model.js';
import { Competency } from '../models/competency.model.js';
import { Skill } from '../models/skill.model.js';
import { RoleRequirement } from '../models/roleRequirement.model.js';

/**
 * Loads a role with its competencies, skills, and baseline requirements
 * resolved from the seeded ontology.
 */
export async function getRoleWithDetails(roleIdOrSlug) {
  const role = await Role.findOne({
    $or: [{ _id: roleIdOrSlug }, { slug: roleIdOrSlug }],
    isActive: true,
  }).lean();
  if (!role) return null;
  const roleId = String(role._id);

  const competencies = await Competency.find({ roleId }).lean();

  const skillIds = competencies.flatMap((c) => c.skillIds ?? []);
  const skills = await Skill.find({ _id: { $in: skillIds } }).lean();
  const skillMap = new Map(skills.map((s) => [String(s._id), s]));

  const requirements = await RoleRequirement.find({ roleId }).lean();

  const competencyDetails = competencies.map((c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    description: c.description ?? null,
    skills: (c.skillIds ?? [])
      .map((id) => skillMap.get(String(id)))
      .filter(Boolean)
      .map((s) => ({
        id: String(s._id),
        name: s.name,
        slug: s.slug,
        category: s.category,
      })),
  }));

  const requirementMap = new Map(
    requirements.map((r) => [r.skillId, { baselineLevel: r.baselineLevel, weight: r.weight }]),
  );

  return {
    id: String(role._id),
    name: role.name,
    slug: role.slug,
    family: role.family,
    description: role.description ?? null,
    competencies: competencyDetails,
    requirements: [...requirementMap.entries()].map(([skillId, req]) => ({
      skillId: String(skillId),
      baselineLevel: req.baselineLevel,
      weight: req.weight,
    })),
  };
}

export async function listRolesWithDetails() {
  const roles = await Role.find({ isActive: true }).sort({ name: 1 }).lean();
  const families = await Role.distinct('family', { isActive: true });

  const familyGroups = new Map(families.map((f) => [f, []]));
  for (const role of roles) {
    const entry = {
      id: String(role._id),
      name: role.name,
      slug: role.slug,
      family: role.family,
      description: role.description ?? null,
    };
    const list = familyGroups.get(role.family) ?? [];
    list.push(entry);
    familyGroups.set(role.family, list);
  }

  return { families: [...familyGroups.keys()], roles };
}