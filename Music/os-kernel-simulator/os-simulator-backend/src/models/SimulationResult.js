const mongoose = require('mongoose');

const simulationResultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      default: 'Untitled Simulation',
      trim: true,
    },
    scheduling: { type: mongoose.Schema.Types.Mixed, default: null },
    memory: { type: mongoose.Schema.Types.Mixed, default: null },
    synchronization: { type: mongoose.Schema.Types.Mixed, default: null },
    processes: { type: mongoose.Schema.Types.Mixed, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

simulationResultSchema.statics.paginate = async function (query, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const [results, total] = await Promise.all([
    this.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    this.countDocuments(query),
  ]);
  return { results, total, totalPages: Math.ceil(total / limit) };
};

module.exports = mongoose.model('SimulationResult', simulationResultSchema);
