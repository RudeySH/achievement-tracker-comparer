declare module 'es6-promise-pool' {
	interface Options<A> {
		promise?: PromiseLike<A>
	}

	declare class PromisePool<A> extends EventTarget {
		constructor(
			source: (() => PromiseLike<A> | void) | Iterator<PromiseLike<A>>,
			concurrency: number,
			options?: Options<A>
		)
		concurrency(concurrency: number): number
		size(): number
		active(): boolean
		promise(): PromiseLike<A>
		start(): PromiseLike<A>
	}

	export default PromisePool
}
