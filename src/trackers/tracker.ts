import { Game } from '../interfaces/game';
import { ProfileData } from '../interfaces/profile-data';
import { RecoverGame } from '../interfaces/recover-game';

export abstract class Tracker {
	abstract readonly name: string;
	readonly signInLink: string | undefined = undefined;
	readonly ownProfileOnly: boolean = false;

	readonly profileData: ProfileData;

	constructor(profileData: ProfileData) {
		this.profileData = profileData;
	}

	abstract getProfileURL(): string;

	abstract getGameURL(appid: number, name: string | undefined): string | undefined;

	abstract getStartedGames(appids?: number[]): Promise<{ games: Game[], signIn?: boolean, signInAs?: string }>;

	abstract getRecoverLinkHTML(games: RecoverGame[]): string | undefined;

	validate(_game: Game): string[] {
		return [];
	}
}
