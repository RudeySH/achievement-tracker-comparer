export interface Game {
	appid: number;
	mgsId?: number;
	tsaGameId?: number;
	tsaUrlName?: string;
	name: string | undefined;
	unlocked: number;
	total: number | undefined;
	isPerfect: boolean | undefined;
	isCompleted: boolean | undefined;
	isCounted: boolean;
	isTrusted: boolean | undefined;
}
