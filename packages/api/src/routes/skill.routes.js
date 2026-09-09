import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Skill } from '../models/skill.model.js';

const router = Router();

router.use(requireAuth);

/** Lists skills from the ontology, optionally limited to a target-role context. */
router.get('/', async (req, res, next) => {
  try {
    const query = { isActive: req.query.all === '1' ? undefined : { $ne: false } };
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const term = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: term }, { slug: term }, { aliases: term }];
    }
    const limit = Math.min(Number(req.query.limit ?? 200), 500);
    const skills = await Skill.find(query).sort({ name: 1 }).limit(limit).lean();
    res.json({
      skills: skills.map((s) => ({
        id: String(s._id),
        name: s.name,
        slug: s.slug,
        category: s.category,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;