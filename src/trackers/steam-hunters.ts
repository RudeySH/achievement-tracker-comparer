import he from 'he';
import { Game } from '../interfaces/game';
import { RecoverGame } from '../interfaces/recover-game';
import { getJSON, iconExternalLink } from '../utils/utils';
import { Tracker } from './tracker';

export class SteamHunters extends Tracker {
	name = 'Steam Hunters';

	override getProfileURL() {
		return `https://steamhunters.com/profiles/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(game: Game) {
		return `https://steamhunters.com/profiles/${this.profileData.steamid}/apps/${game.appid}?utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const licenses = await getJSON<{ [appid: string]: LicenseDetailItem }>(`https://steamhunters.com/api/steam-users/${this.profileData.steamid}/licenses?state=started&utm_campaign=userscript`);

		const games = Object.entries(licenses).map<Game>(([appid, license]) => ({
			appid: parseInt(appid),
			name: license.app.name,
			unlocked: license.achievementUnlockCount,
			total: license.app.achievementCount,
			isPerfect: license.achievementUnlockCount >= license.app.achievementCount,
			isCompleted: license.isCompleted,
			isCounted: license.isCompleted && !license.isInvalid,
			isTrusted: !license.app.isRestricted,
		}));

		return { games };
	}

	override getRecoverLinkHTML(games: RecoverGame[]) {
		return `
			<form method="post" action="https://steamhunters.com/profiles/${this.profileData.steamid}/recover?utm_campaign=userscript" target="_blank">
				<input type="hidden" name="version" value="2.0">
				<input type="hidden" name="apps" value="${he.escape(JSON.stringify(games))}">
				<button type="submit" class="whiteLink">
					Recover ${iconExternalLink}
				</button>
			</form>`;
	}
}

interface AppDetails {
	name: string | undefined;
	achievementCount: number;
	unobtainableAchievementCount: number;
	points: number;
	fastestCompletionTime: number | undefined;
	medianCompletionTime: number | undefined;
	isRemoved: boolean | undefined;
	isRestricted: boolean | undefined;
}

interface LicenseDetailItem {
	playtime: number;
	isInvalid: boolean;
	achievementUnlockCount: number;
	points: number;
	completionTime: number | undefined;
	isCompleted: boolean;
	app: AppDetails;
}
