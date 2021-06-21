export interface Game {
	appid: number;
	unlocked: number;
	total: number | undefined;
	name: string | undefined;
	isPerfect: boolean | undefined;
	isCompleted: boolean | undefined;
	isCounted: boolean;
	isTrusted: boolean | undefined;
}
