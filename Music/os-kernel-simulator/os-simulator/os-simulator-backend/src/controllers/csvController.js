const fs = require('fs');
const { parse } = require('csv-parse/sync');
const {
  runFCFS, runSJF, runRoundRobin, runPriority,
  runFIFO, runLRU, runOptimal,
} = require('../services/osSimulator');
const logger = require('../utils/logger');

exports.uploadSchedulingCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No CSV file uploaded.' });

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

    const processes = records.map((row, i) => ({
      pid: parseInt(row.pid) || i + 1,
      name: row.name || `P${i + 1}`,
      arrivalTime: parseInt(row.arrivalTime || row.arrival_time || row.arrival) || 0,
      burstTime: parseInt(row.burstTime || row.burst_time || row.burst) || 1,
      priority: parseInt(row.priority) || 1,
    }));

    if (processes.length === 0) return res.status(400).json({ message: 'No valid processes in CSV.' });

    const algorithm = req.query.algorithm || 'FCFS';
    const quantum = parseInt(req.query.quantum) || 2;

    let result;
    switch (algorithm) {
      case 'FCFS':       result = runFCFS(processes); break;
      case 'SJF':        result = runSJF(processes); break;
      case 'RoundRobin': result = runRoundRobin(processes, quantum); break;
      case 'Priority':   result = runPriority(processes); break;
      default:           result = runFCFS(processes);
    }

    // Cleanup uploaded file
    fs.unlinkSync(req.file.path);

    logger.info(`CSV scheduling imported: ${processes.length} processes, algo: ${algorithm}`);
    res.json({ success: true, data: result });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
};

exports.uploadMemoryCSV = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No CSV file uploaded.' });

    const content = fs.readFileSync(req.file.path, 'utf-8');
    const numbers = content.split(/[\s,\n]+/).map(Number).filter((n) => !isNaN(n) && n >= 0);

    if (numbers.length === 0) return res.status(400).json({ message: 'No valid page numbers in CSV.' });

    const algorithm = req.query.algorithm || 'FIFO';
    const frameCount = parseInt(req.query.frameCount) || 3;

    let result;
    switch (algorithm) {
      case 'FIFO':    result = runFIFO(numbers, frameCount); break;
      case 'LRU':     result = runLRU(numbers, frameCount); break;
      case 'Optimal': result = runOptimal(numbers, frameCount); break;
      default:        result = runFIFO(numbers, frameCount);
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, data: result });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(err);
  }
};
