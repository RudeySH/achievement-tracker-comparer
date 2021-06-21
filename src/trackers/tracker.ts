import { Game } from '../interfaces/game';
import { ProfileData } from '../interfaces/profile-data';
import { RecoverGame } from '../interfaces/recover-game';

export abstract class Tracker {
	abstract readonly name: string;
	abstract readonly signInRequired: boolean;
	readonly profileData: ProfileData;

	constructor(profileData: ProfileData) {
		this.profileData = profileData;
	}

	abstract getProfileURL(): string;

	abstract getGameURL(appid: number): string | undefined;

	abstract getStartedGames(appids?: number[]): Promise<{ message?: string, games: Game[] }>;

	abstract getRecoverLinkHTML(games: RecoverGame[]): string | undefined;

	validate(_game: Game): string[] {
		return [];
	}
}
