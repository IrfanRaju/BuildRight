import mongoose from 'mongoose';

const designProjectSchema = new mongoose.Schema({
  ownerId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  messages: {
    type: [{
      role: { type: String, enum: ['user', 'assistant'], required: true },
      text: { type: String, required: true, maxlength: 5000 },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
  source: { type: String, default: 'BuildRight procedural geometry' },
  versions: {
    type: [{
      savedAt: { type: Date, default: Date.now },
      title: { type: String, maxlength: 120 },
      config: { type: mongoose.Schema.Types.Mixed },
    }],
    default: [],
  },
}, { timestamps: true, minimize: false });

designProjectSchema.index({ ownerId: 1, updatedAt: -1 });

export default mongoose.models.DesignProject || mongoose.model('DesignProject', designProjectSchema);
