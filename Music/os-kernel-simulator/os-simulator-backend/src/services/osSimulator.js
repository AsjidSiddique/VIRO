// ═══════════════════════════════════════════════════════════
//  OS KERNEL SIMULATOR — Full Service Layer
//  1. CPU Scheduling  2. Memory Management
//  3. Process Sync    4. Process & Thread Management
// ═══════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
const calcMetrics = (result, totalTime) => {
  const n = result.length;
  if (n === 0) return {};
  const avgWaitingTime = result.reduce((s, p) => s + p.waitingTime, 0) / n;
  const avgTurnaroundTime = result.reduce((s, p) => s + p.turnaroundTime, 0) / n;
  const totalBurst = result.reduce((s, p) => s + p.burstTime, 0);
  const cpuUtilization = parseFloat(((totalBurst / totalTime) * 100).toFixed(2));
  const throughput = parseFloat((n / totalTime).toFixed(4));
  return { avgWaitingTime, avgTurnaroundTime, cpuUtilization, throughput };
};

// ─────────────────────────────────────────────────────────────
//  1. CPU SCHEDULING
// ─────────────────────────────────────────────────────────────

const runFCFS = (processes) => {
  const procs = processes
    .map((p) => ({ ...p, remainingTime: p.burstTime }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  let time = 0;
  const gantt = [];
  const result = [];

  for (const p of procs) {
    if (time < p.arrivalTime) {
      gantt.push({ pid: -1, start: time, end: p.arrivalTime });
      time = p.arrivalTime;
    }
    const start = time;
    time += p.burstTime;
    gantt.push({ pid: p.pid, start, end: time });
    const waitingTime = start - p.arrivalTime;
    const turnaroundTime = time - p.arrivalTime;
    result.push({ ...p, waitingTime, turnaroundTime, completionTime: time });
  }

  return { algorithm: 'FCFS', processes: result, ganttChart: gantt, metrics: calcMetrics(result, time) };
};

const runSJF = (processes) => {
  const procs = processes.map((p) => ({ ...p, done: false }));
  let time = 0;
  const gantt = [];
  const result = [];
  let completed = 0;

  while (completed < procs.length) {
    const available = procs.filter((p) => p.arrivalTime <= time && !p.done);
    if (available.length === 0) {
      const next = procs.filter((p) => !p.done).sort((a, b) => a.arrivalTime - b.arrivalTime)[0];
      gantt.push({ pid: -1, start: time, end: next.arrivalTime });
      time = next.arrivalTime;
      continue;
    }
    const p = available.sort((a, b) => a.burstTime - b.burstTime)[0];
    const start = time;
    time += p.burstTime;
    p.done = true;
    completed++;
    gantt.push({ pid: p.pid, start, end: time });
    result.push({ ...p, waitingTime: start - p.arrivalTime, turnaroundTime: time - p.arrivalTime, completionTime: time });
  }

  return { algorithm: 'SJF', processes: result, ganttChart: gantt, metrics: calcMetrics(result, time) };
};

const runRoundRobin = (processes, quantum = 2) => {
  const procs = processes
    .map((p) => ({ ...p, remainingTime: p.burstTime, done: false }))
    .sort((a, b) => a.arrivalTime - b.arrivalTime);

  let time = 0;
  const gantt = [];
  const completionTimes = {};
  const queue = [];
  let i = 0;

  while (i < procs.length && procs[i].arrivalTime <= time) queue.push(procs[i++]);

  while (queue.length > 0) {
    const p = queue.shift();
    const execTime = Math.min(p.remainingTime, quantum);
    gantt.push({ pid: p.pid, start: time, end: time + execTime });
    time += execTime;
    p.remainingTime -= execTime;
    while (i < procs.length && procs[i].arrivalTime <= time) queue.push(procs[i++]);
    if (p.remainingTime > 0) queue.push(p);
    else completionTimes[p.pid] = time;
  }

  const result = procs.map((p) => ({
    ...p,
    completionTime: completionTimes[p.pid],
    waitingTime: completionTimes[p.pid] - p.arrivalTime - p.burstTime,
    turnaroundTime: completionTimes[p.pid] - p.arrivalTime,
  }));

  return { algorithm: 'RoundRobin', quantum, processes: result, ganttChart: gantt, metrics: calcMetrics(result, time) };
};

const runPriority = (processes) => {
  const procs = processes.map((p) => ({ ...p, done: false }));
  let time = 0;
  const gantt = [];
  const result = [];
  let completed = 0;

  while (completed < procs.length) {
    const available = procs.filter((p) => p.arrivalTime <= time && !p.done);
    if (available.length === 0) {
      const next = procs.filter((p) => !p.done).sort((a, b) => a.arrivalTime - b.arrivalTime)[0];
      gantt.push({ pid: -1, start: time, end: next.arrivalTime });
      time = next.arrivalTime;
      continue;
    }
    const p = available.sort((a, b) => a.priority - b.priority)[0];
    const start = time;
    time += p.burstTime;
    p.done = true;
    completed++;
    gantt.push({ pid: p.pid, start, end: time });
    result.push({ ...p, waitingTime: start - p.arrivalTime, turnaroundTime: time - p.arrivalTime, completionTime: time });
  }

  return { algorithm: 'Priority', processes: result, ganttChart: gantt, metrics: calcMetrics(result, time) };
};

// ─────────────────────────────────────────────────────────────
//  2. MEMORY MANAGEMENT
// ─────────────────────────────────────────────────────────────

const runFIFO = (referenceString, frameCount) => {
  const frames = [];
  const steps = [];
  let pageFaults = 0;

  for (let i = 0; i < referenceString.length; i++) {
    const page = referenceString[i];
    let pageFault = false;
    let replacedPage = null;

    if (!frames.includes(page)) {
      pageFault = true;
      pageFaults++;
      if (frames.length >= frameCount) replacedPage = frames.shift();
      frames.push(page);
    }

    steps.push({ step: i + 1, page, frames: [...frames], pageFault, replacedPage });
  }

  const hitRatio = parseFloat(((referenceString.length - pageFaults) / referenceString.length).toFixed(4));
  return { algorithm: 'FIFO', frameCount, referenceString, frames: steps, totalPageFaults: pageFaults, hitRatio };
};

const runLRU = (referenceString, frameCount) => {
  let frames = [];
  const steps = [];
  let pageFaults = 0;

  for (let i = 0; i < referenceString.length; i++) {
    const page = referenceString[i];
    let pageFault = false;
    let replacedPage = null;

    if (!frames.includes(page)) {
      pageFault = true;
      pageFaults++;
      if (frames.length >= frameCount) {
        let lruPage = null;
        let lruTime = Infinity;
        for (const f of frames) {
          const lastUsed = referenceString.slice(0, i).lastIndexOf(f);
          if (lastUsed < lruTime) { lruTime = lastUsed; lruPage = f; }
        }
        replacedPage = lruPage;
        frames = frames.filter((f) => f !== lruPage);
      }
      frames.push(page);
    } else {
      frames = frames.filter((f) => f !== page);
      frames.push(page);
    }

    steps.push({ step: i + 1, page, frames: [...frames], pageFault, replacedPage });
  }

  const hitRatio = parseFloat(((referenceString.length - pageFaults) / referenceString.length).toFixed(4));
  return { algorithm: 'LRU', frameCount, referenceString, frames: steps, totalPageFaults: pageFaults, hitRatio };
};

const runOptimal = (referenceString, frameCount) => {
  let frames = [];
  const steps = [];
  let pageFaults = 0;

  for (let i = 0; i < referenceString.length; i++) {
    const page = referenceString[i];
    let pageFault = false;
    let replacedPage = null;

    if (!frames.includes(page)) {
      pageFault = true;
      pageFaults++;
      if (frames.length >= frameCount) {
        let farthest = -1;
        let pageToReplace = frames[0];
        for (const f of frames) {
          const nextUse = referenceString.slice(i + 1).indexOf(f);
          if (nextUse === -1) { pageToReplace = f; break; }
          if (nextUse > farthest) { farthest = nextUse; pageToReplace = f; }
        }
        replacedPage = pageToReplace;
        frames = frames.filter((f) => f !== pageToReplace);
      }
      frames.push(page);
    }

    steps.push({ step: i + 1, page, frames: [...frames], pageFault, replacedPage });
  }

  const hitRatio = parseFloat(((referenceString.length - pageFaults) / referenceString.length).toFixed(4));
  return { algorithm: 'Optimal', frameCount, referenceString, frames: steps, totalPageFaults: pageFaults, hitRatio };
};

// ─────────────────────────────────────────────────────────────
//  3. PROCESS SYNCHRONIZATION
// ─────────────────────────────────────────────────────────────

const runSemaphore = (threadCount = 4, semaphoreValue = 2, iterations = 2, semaphoreType = 'counting') => {
  // Enforce binary semaphore range: value is always 0 or 1
  const initValue = semaphoreType === 'binary' ? Math.min(1, Math.max(0, semaphoreValue)) : semaphoreValue;

  const log = [];
  let racesDetected = 0;

  // Semaphore state — integer value as per the textbook definition
  // Counting: unrestricted non-negative integer
  // Binary:   only 0 or 1
  const S = { value: initValue, list: [] }; // list holds blocked thread names
  let globalTime = 0;

  // Textbook wait(S): S.value--; if (S.value < 0) { add to list; block(); }
  const semWait = (thread) => {
    S.value--;
    if (S.value < 0) {
      // Thread must block — add to waiting list
      S.list.push(thread);
      log.push({
        time: globalTime++,
        event: `${thread} called wait() — value now ${S.value}, BLOCKED (waiting list: [${S.list.join(', ')}])`,
        thread,
        resource: `S.value=${S.value}`,
        state: 'BLOCKED',
      });
      racesDetected++;
      // Simulate the block duration (another thread will signal it)
      globalTime += 1;
      return false; // blocked
    }
    // Thread proceeds
    log.push({
      time: globalTime++,
      event: `${thread} called wait() — value now ${S.value}, ACQUIRED (slots available: ${S.value})`,
      thread,
      resource: `S.value=${S.value}`,
      state: 'ACQUIRED',
    });
    return true; // acquired
  };

  // Simulate all threads across iterations
  for (let iter = 0; iter < iterations; iter++) {
    const batch = [];
    for (let t = 1; t <= threadCount; t++) batch.push(`Thread-${t}`);

    // Track which threads acquired (not blocked) per iteration
    const inCS = [];
    // Track which blocked threads got woken mid-iteration (handled inside signal)
    const wokeThisIter = new Set();

    // Phase 1: all threads call wait()
    for (const thread of batch) {
      const acquired = semWait(thread);
      if (acquired) {
        inCS.push(thread);
        const concurrent = inCS.filter(x => x !== thread);
        log.push({
          time: globalTime++,
          event: `${thread} in critical section${concurrent.length > 0 ? ` (concurrent with: ${concurrent.join(', ')})` : ''}`,
          thread,
          resource: `S.value=${S.value}`,
          state: 'RUNNING',
        });
      }
    }

    // Phase 2: acquired threads exit and call signal()
    for (const thread of inCS) {
      log.push({
        time: globalTime++,
        event: `${thread} exiting critical section — calling signal()`,
        thread,
        resource: `S.value=${S.value}`,
        state: 'RUNNING',
      });

      S.value++;
      if (semaphoreType === 'binary' && S.value > 1) S.value = 1;

      if (S.value <= 0 && S.list.length > 0) {
        // Wake a blocked thread — it runs its CS then signals; don't double-log it
        const woken = S.list.shift();
        wokeThisIter.add(woken);
        log.push({
          time: globalTime++,
          event: `${thread} signal() — value now ${S.value}, woke up ${woken}`,
          thread,
          resource: `S.value=${S.value}`,
          state: 'RELEASED',
        });
        log.push({
          time: globalTime++,
          event: `${woken} WOKEN — entered critical section (value: ${S.value})`,
          thread: woken,
          resource: `S.value=${S.value}`,
          state: 'RUNNING',
        });
        // woken thread exits and signals — one clean signal, no recursion
        log.push({
          time: globalTime++,
          event: `${woken} exiting critical section — calling signal()`,
          thread: woken,
          resource: `S.value=${S.value}`,
          state: 'RUNNING',
        });
        S.value++;
        if (semaphoreType === 'binary' && S.value > 1) S.value = 1;
        log.push({
          time: globalTime++,
          event: `${woken} signal() — value now ${S.value}, RELEASED`,
          thread: woken,
          resource: `S.value=${S.value}`,
          state: 'RELEASED',
        });
      } else {
        log.push({
          time: globalTime++,
          event: `${thread} signal() — value now ${S.value}, RELEASED`,
          thread,
          resource: `S.value=${S.value}`,
          state: 'RELEASED',
        });
      }
    }
  }

  const primitiveLabel = semaphoreType === 'binary' ? 'Binary Semaphore' : 'Counting Semaphore';
  return {
    primitive: primitiveLabel,
    semaphoreType,
    threadCount,
    iterations,
    semaphoreValue: initValue,
    log,
    racesDetected,
    deadlockDetected: false,
  };
};

// ─────────────────────────────────────────────────────────────
//  4. PROCESS & THREAD MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Simulate process lifecycle with simple PCB and TCB structures.
 * Uses a global CPU time cursor so processes don't overlap on the CPU.
 */
const runProcessManagement = (processCount = 4, includeThreads = true, threadsPerProcess = 2) => {
  const pcbs = [];
  const stateLog = [];

  // Create PCBs — arrival is staggered but CPU is exclusive (FCFS order)
  for (let i = 1; i <= processCount; i++) {
    const pid = i;
    const burstTime = Math.floor(Math.random() * 6) + 3;
    const arrivalTime = (i - 1) * 2;
    const priority = Math.floor(Math.random() * 5) + 1;
    const isIO = Math.random() > 0.5;

    const pcb = {
      pid,
      name: `P${pid}`,
      state: 'NEW',
      priority,
      burstTime,
      arrivalTime,
      waitingTime: 0,
      turnaroundTime: 0,
      processType: isIO ? 'I/O-bound' : 'CPU-bound',
      threads: [],
      ioRequests: 0,
      contextSwitches: 0,
    };

    // Create TCBs
    if (includeThreads) {
      for (let t = 1; t <= threadsPerProcess; t++) {
        pcb.threads.push({
          tid: `${pid}.${t}`,
          name: `T${pid}.${t}`,
          state: 'NEW',
          priority: pcb.priority,
        });
      }
    }

    pcbs.push(pcb);
  }

  // Global CPU cursor — ensures only one process is on the CPU at a time
  let cpuTime = 0;

  for (const pcb of pcbs) {
    // Process arrives (NEW → READY) at its arrival time
    const arrivalT = pcb.arrivalTime;
    stateLog.push({
      time: arrivalT,
      pid: pcb.pid, name: pcb.name,
      fromState: 'NEW', toState: 'READY',
      event: `${pcb.name} created and added to ready queue`,
      isThread: false,
    });

    // CPU becomes available at cpuTime; process can't start before it arrives
    const dispatchT = Math.max(cpuTime, arrivalT + 1);
    stateLog.push({
      time: dispatchT,
      pid: pcb.pid, name: pcb.name,
      fromState: 'READY', toState: 'RUNNING',
      event: `${pcb.name} dispatched — CPU allocated`,
      isThread: false,
    });

    // Threads are spawned only after the process is on the CPU
    let t = dispatchT + 1;
    if (includeThreads) {
      for (const thread of pcb.threads) {
        stateLog.push({
          time: t++,
          pid: pcb.pid, tid: thread.tid, name: thread.name,
          fromState: 'NEW', toState: 'RUNNING',
          event: `${thread.name} spawned and running (inside ${pcb.name})`,
          isThread: true,
        });
      }
    }

    // I/O wait: RUNNING → WAITING → READY → RUNNING
    if (pcb.processType === 'I/O-bound') {
      stateLog.push({ time: t++, pid: pcb.pid, name: pcb.name, fromState: 'RUNNING', toState: 'WAITING', event: `${pcb.name} issued I/O request — CPU released`, isThread: false });
      pcb.ioRequests++;
      pcb.contextSwitches++;
      t += 2; // I/O duration
      stateLog.push({ time: t++, pid: pcb.pid, name: pcb.name, fromState: 'WAITING', toState: 'READY', event: `${pcb.name} I/O complete — back in ready queue`, isThread: false });
      stateLog.push({ time: t++, pid: pcb.pid, name: pcb.name, fromState: 'READY', toState: 'RUNNING', event: `${pcb.name} re-dispatched — CPU re-allocated`, isThread: false });
    }

    // Threads finish before process terminates
    if (includeThreads) {
      for (const thread of pcb.threads) {
        stateLog.push({ time: t++, pid: pcb.pid, tid: thread.tid, name: thread.name, fromState: 'RUNNING', toState: 'TERMINATED', event: `${thread.name} finished`, isThread: true });
      }
    }

    // Process terminates — next process can start at exactly t (no wasted tick)
    pcb.completionTime = t;
    pcb.turnaroundTime = t - arrivalT;
    pcb.waitingTime = Math.max(0, dispatchT - arrivalT);
    stateLog.push({ time: t, pid: pcb.pid, name: pcb.name, fromState: 'RUNNING', toState: 'TERMINATED', event: `${pcb.name} finished — PCB released`, isThread: false });

    // Next process dispatched at t (same tick as this process terminates)
    cpuTime = t;
  }

  stateLog.sort((a, b) => a.time - b.time);

  const metrics = {
    totalProcesses: processCount,
    totalThreads: includeThreads ? processCount * threadsPerProcess : 0,
    avgTurnaroundTime: parseFloat((pcbs.reduce((s, p) => s + p.turnaroundTime, 0) / pcbs.length).toFixed(2)),
    avgWaitingTime: parseFloat((pcbs.reduce((s, p) => s + p.waitingTime, 0) / pcbs.length).toFixed(2)),
    totalContextSwitches: pcbs.reduce((s, p) => s + p.contextSwitches, 0),
    totalIoRequests: pcbs.reduce((s, p) => s + p.ioRequests, 0),
    cpuBoundCount: pcbs.filter((p) => p.processType === 'CPU-bound').length,
    ioBoundCount: pcbs.filter((p) => p.processType === 'I/O-bound').length,
  };

  return {
    module: 'ProcessManagement',
    processCount,
    threadsPerProcess: includeThreads ? threadsPerProcess : 0,
    pcbs: pcbs.map((p) => ({ ...p, state: 'TERMINATED' })),
    stateLog,
    metrics,
  };
};

module.exports = {
  // Scheduling
  runFCFS, runSJF, runRoundRobin, runPriority,
  // Memory
  runFIFO, runLRU, runOptimal,
  // Sync
  runSemaphore,
  // Process & Thread Management
  runProcessManagement,
};
