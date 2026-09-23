/**
 * منظِّم تزامن بسيط: يمنع انهيار المزوّدات المجانية عند إطلاق عشرات الطلبات دفعة واحدة.
 *
 * بدونه، تشغيل ٢٠+ قدرة في نفس اللحظة يجعل كل الطلبات تصطدم بحد المعدل (429) معاً،
 * فيفشل نصفها رغم أن المزوّد قادر على خدمتها لو وصلت على دفعات.
 */
type Task<T> = () => Promise<T>;

class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async run<T>(task: Task<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

/** نداءات النماذج اللغوية: المزوّدات المجانية تتحمل ٤ طلبات متزامنة بثبات. */
const llm = new Semaphore(4);
/** توليد الصور: أبطأ وأكثر حساسية للضغط. */
const image = new Semaphore(2);

export const limitLlm = <T>(task: Task<T>) => llm.run(task);
export const limitImage = <T>(task: Task<T>) => image.run(task);
