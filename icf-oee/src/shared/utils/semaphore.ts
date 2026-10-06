const DEFAULT_MAX_CONCURRENT_TASKS = 15;

type PendingTask = () => void;

/**
 * Limits how many CDF requests run at the same time, to stay under the API
 * concurrency limits (429 Too Many Requests).
 */
export class QueuedTaskRunner {
  private readonly pendingTasks: PendingTask[] = [];
  private runningTasks = 0;

  public constructor(private readonly maxConcurrentTasks: number = DEFAULT_MAX_CONCURRENT_TASKS) {}

  public schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pendingTasks.push(() => {
        this.runningTasks++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            this.runningTasks--;
            this.startNextTask();
          });
      });
      this.startNextTask();
    });
  }

  private startNextTask(): void {
    if (this.runningTasks >= this.maxConcurrentTasks) return;
    const next = this.pendingTasks.shift();
    next?.();
  }
}

/** Global runner for CDF API requests. Do not nest `schedule` calls. */
export const cdfTaskRunner = new QueuedTaskRunner();
