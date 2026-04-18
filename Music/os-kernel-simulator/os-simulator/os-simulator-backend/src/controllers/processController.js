const { runProcessManagement } = require('../services/osSimulator');
const SimulationResult = require('../models/SimulationResult');
const logger = require('../utils/logger');

exports.runProcessSim = async (req, res, next) => {
  try {
    const {
      processCount = 4,
      includeThreads = true,
      threadsPerProcess = 2,
    } = req.body;

    if (processCount < 1 || processCount > 10)
      return res.status(400).json({ message: 'processCount must be between 1 and 10.' });

    const result = runProcessManagement(
      parseInt(processCount),
      Boolean(includeThreads),
      parseInt(threadsPerProcess)
    );

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};
