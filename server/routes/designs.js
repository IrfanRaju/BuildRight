import mongoose from 'mongoose';
import { DesignSpecification, GenerationJob } from '../models/index.js';
import { validateDesign } from '../../src/design-engine.js';
import DesignProject from '../models/DesignProject.js';
import { interpretDesign } from '../services/aiProvider.js';
import { recordAudit } from '../services/database.js';

export function createDesignRouter({ Router, env, requireUser, optionalUser, requireDatabase }) {
  const router = Router();

  router.post('/generate', optionalUser, async (req, res, next) => {
    const prompt = req.body?.prompt;
    let job = null;
    try {
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 5000) {
        return res.status(400).json({ error: 'Prompt must contain between 1 and 5000 characters.' });
      }
      if (mongoose.connection.readyState === 1) {
        job = await GenerationJob.create({
          ownerId: req.user?.id || null,
          prompt: prompt.trim(),
          status: 'processing',
          provider: env.aiProvider,
        });
      }
      const generated = await interpretDesign(prompt, req.body?.previousConfig || req.body?.config || {}, env);
      validateDesign(generated.config);
      if (job) {
        job.status = 'completed';
        job.provider = generated.ai?.provider || 'procedural';
        job.resultSummary = `${generated.config.projectType} · ${generated.config.floors} floors · ${generated.source}`;
        await job.save();
      }
      if (mongoose.connection.readyState === 1) {
        await DesignSpecification.create({
          ownerId: req.user?.id || null,
          prompt: prompt.trim(),
          specification: generated.config,
          questions: generated.config.questions || [],
          assumptions: generated.config.assumptions || [],
        });
      }
      return res.json({
        config: { ...generated.config, ...(req.body?.config?.budget ? { budget: req.body.config.budget } : {}) },
        source: generated.source,
        limitations: 'Conceptual geometry only. This is not an engineered or permit-ready drawing.',
        questions: generated.config.questions || [],
        assumptions: generated.config.assumptions || [],
        ai: generated.ai,
        jobId: job?._id || null,
      });
    } catch (error) {
      if (job) {
        job.status = 'failed';
        job.error = error.message || 'Generation failed';
        await job.save().catch(() => {});
      }
      return next(error.status ? error : Object.assign(error, { status: 400 }));
    }
  });

  router.get('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const projects = await DesignProject.find({ ownerId: req.user.id }).sort({ updatedAt: -1 }).limit(100).lean();
      return res.json({ projects });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const { title, config, messages = [], source, versions = [] } = req.body || {};
      validateDesign(config);
      if (typeof title !== 'string' || !title.trim() || title.length > 120) {
        return res.status(400).json({ error: 'Project title must contain 1 to 120 characters.' });
      }
      if (!Array.isArray(messages) || messages.length > 200 || messages.some((message) => !['user', 'assistant'].includes(message.role) || typeof message.text !== 'string' || message.text.length > 5000)) {
        return res.status(400).json({ error: 'Project conversation has an invalid format.' });
      }
      const project = await DesignProject.create({
        ownerId: req.user.id,
        title: title.trim(),
        config,
        messages,
source: typeof source === 'string' ? source.slice(0, 120) : 'BuildRight procedural geometry',
      versions: Array.isArray(versions) ? versions.slice(0, 8) : [],
    });
      await recordAudit(req, 'design.save', 'DesignProject', project._id);
      return res.status(201).json({ project });
    } catch (error) {
      if (error.message?.includes('must be') || error.message?.includes('Please provide')) return res.status(400).json({ error: error.message });
      return next(error);
    }
  });

  router.put('/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const { title, config, messages, source, versions } = req.body || {};
      if (config) validateDesign(config);
      const update = {};
      if (typeof title === 'string' && title.trim() && title.length <= 120) update.title = title.trim();
      if (config) update.config = config;
      if (Array.isArray(messages) && messages.length <= 200) update.messages = messages;
      if (typeof source === 'string') update.source = source.slice(0, 120);
    if (Array.isArray(versions)) update.versions = versions.slice(0, 8);
      const project = await DesignProject.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.user.id },
        { $set: update },
        { new: true, runValidators: true },
      ).lean();
      if (!project) return res.status(404).json({ error: 'Saved design was not found.' });
      return res.json({ project });
    } catch (error) {
      if (error.name === 'CastError') return res.status(400).json({ error: 'Project ID is invalid.' });
      return next(error);
    }
  });

  router.delete('/:id', requireUser, requireDatabase, async (req, res, next) => {
    try {
      const deleted = await DesignProject.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
      if (!deleted) return res.status(404).json({ error: 'Saved design was not found.' });
      return res.status(204).end();
    } catch (error) {
      if (error.name === 'CastError') return res.status(400).json({ error: 'Project ID is invalid.' });
      return next(error);
    }
  });

  return router;
}
