import { Router } from 'express';
import { UpdateProfileInputSchema } from '@career/shared';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import { Profile } from '../models/profile.model.js';

const router = Router();

router.use(requireAuth);

const serializeProfile = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  profileType: doc.profileType,
  headline: doc.headline ?? null,
  bio: doc.bio ?? null,
  location: doc.location ?? null,
  education: doc.education ?? [],
  yearsOfExperience: doc.yearsOfExperience ?? 0,
  githubUsername: doc.githubUsername ?? null,
  portfolioUrl: doc.portfolioUrl ?? null,
  linkedinUrl: doc.linkedinUrl ?? null,
  selfReportedSkills: doc.selfReportedSkills ?? [],
  targetRoleIds: doc.targetRoleIds ?? [],
  company: doc.company ?? null,
  title: doc.title ?? null,
});

router.get('/me', async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });
    if (!profile) {
      throw new AppError('Profile not found. Please create your profile.', 404);
    }
    res.json(serializeProfile(profile));
  } catch (err) {
    next(err);
  }
});

router.patch('/me', validate(UpdateProfileInputSchema), async (req, res, next) => {
  try {
    let profile = await Profile.findOne({ userId: req.user.id });
    if (!profile) {
      profile = await Profile.create({
        userId: req.user.id,
        profileType: 'student',
      });
    }

    const allowed = { ...req.body };
    delete allowed.createdAt;
    delete allowed.updatedAt;
    delete allowed.id;
    delete allowed.userId;

    Object.assign(profile, allowed);
    await profile.save();

    res.json(serializeProfile(profile));
  } catch (err) {
    next(err);
  }
});

router.get('/public/:id', async (req, res, next) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile) {
      throw new AppError('Profile not found', 404);
    }
    res.json(serializeProfile(profile));
  } catch (err) {
    next(err);
  }
});

export default router;