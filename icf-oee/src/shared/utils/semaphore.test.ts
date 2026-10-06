import { describe, expect, it } from 'vitest';

import { QueuedTaskRunner } from './semaphore';

describe(QueuedTaskRunner.name, () => {
  it('returns the result of the scheduled task', async () => {
    const runner = new QueuedTaskRunner(2);

    await expect(runner.schedule(() => Promise.resolve('done'))).resolves.toBe('done');
  });

  it('never runs more tasks at once than the limit', async () => {
    const runner = new QueuedTaskRunner(2);
    let running = 0;
    let maxRunning = 0;
    const task = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await Promise.resolve();
      running--;
    };

    await Promise.all(Array.from({ length: 6 }, () => runner.schedule(task)));

    expect(maxRunning).toBe(2);
  });

  it('rejects with the task error and keeps running the next tasks', async () => {
    const runner = new QueuedTaskRunner(1);

    const failed = runner.schedule(() => Promise.reject(new Error('boom')));
    const next = runner.schedule(() => Promise.resolve('next'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('next');
  });
});
