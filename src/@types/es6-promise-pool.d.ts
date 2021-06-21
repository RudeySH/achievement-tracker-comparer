declare class PromisePool {
	constructor(source: Generator, concurrency: number);
	start(): Promise<void>;
}
