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

	abstract getProfileURL(): string | undefined;

	abstract getGameURL(game: Game): string | undefined;

	abstract getStartedGames(formData: FormData, appids: number[]): Promise<{ games: Game[], signIn?: boolean, signInAs?: string, error?: string }>;

	abstract getRecoverLinkHTML(isOwnProfile: boolean, games: RecoverGame[]): string | undefined;

	validate(_game: Game): string[] {
		return [];
	}
}
