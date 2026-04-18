const SimulationResult = require('../models/SimulationResult');
const {
  runFCFS, runSJF, runRoundRobin, runPriority,
  runFIFO, runLRU, runOptimal,
  runSemaphore,
} = require('../services/osSimulator');
const logger = require('../utils/logger');

exports.runScheduling = async (req, res, next) => {
  try {
    const { algorithm, processes, quantum } = req.body;
    if (!algorithm || !processes || !Array.isArray(processes) || processes.length === 0)
      return res.status(400).json({ message: 'algorithm and processes[] are required.' });

    let result;
    switch (algorithm) {
      case 'FCFS':       result = runFCFS(processes); break;
      case 'SJF':        result = runSJF(processes); break;
      case 'RoundRobin': result = runRoundRobin(processes, quantum || 2); break;
      case 'Priority':   result = runPriority(processes); break;
      default: return res.status(400).json({ message: `Unknown algorithm: ${algorithm}` });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.runMemory = async (req, res, next) => {
  try {
    const { algorithm, referenceString, frameCount } = req.body;
    if (!algorithm || !referenceString || !frameCount)
      return res.status(400).json({ message: 'algorithm, referenceString[], and frameCount are required.' });
    if (!Array.isArray(referenceString) || referenceString.length === 0)
      return res.status(400).json({ message: 'referenceString must be a non-empty array.' });

    let result;
    switch (algorithm) {
      case 'FIFO':    result = runFIFO(referenceString, frameCount); break;
      case 'LRU':     result = runLRU(referenceString, frameCount); break;
      case 'Optimal': result = runOptimal(referenceString, frameCount); break;
      default: return res.status(400).json({ message: `Unknown algorithm: ${algorithm}` });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.runSync = async (req, res, next) => {
  try {
    const { primitive, threadCount, iterations, semaphoreValue } = req.body;
    if (!primitive) return res.status(400).json({ message: 'primitive is required: Semaphore' });

    let result;
    const { semaphoreType } = req.body;
    switch (primitive) {
      case 'Semaphore': result = runSemaphore(threadCount || 4, semaphoreValue || 2, iterations || 2, semaphoreType || 'counting'); break;
      default: return res.status(400).json({ message: `Unknown primitive: ${primitive}` });
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.saveResult = async (req, res, next) => {
  try {
    const { title, scheduling, memory, synchronization, processes, notes } = req.body;
    const saved = await SimulationResult.create({
      user: req.user._id,
      title: title || 'Untitled Simulation',
      scheduling, memory, synchronization, processes, notes,
    });
    logger.info(`Simulation saved by ${req.user.email} — id: ${saved._id}`);
    res.status(201).json({ success: true, data: saved });
  } catch (err) { next(err); }
};

exports.getResults = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { results, total, totalPages } = await SimulationResult.paginate({ user: req.user._id }, page, limit);
    res.json({ success: true, data: results, pagination: { page, limit, total, totalPages } });
  } catch (err) { next(err); }
};

exports.getResultById = async (req, res, next) => {
  try {
    const result = await SimulationResult.findOne({ _id: req.params.id, user: req.user._id });
    if (!result) return res.status(404).json({ message: 'Simulation result not found.' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

exports.deleteResult = async (req, res, next) => {
  try {
    const result = await SimulationResult.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!result) return res.status(404).json({ message: 'Simulation result not found.' });
    res.json({ success: true, message: 'Simulation deleted.' });
  } catch (err) { next(err); }
};
