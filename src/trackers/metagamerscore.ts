import { Game } from '../interfaces/game';
import { getJSON, getRedirectURL, iconExternalLink, trim } from '../utils/utils';
import { Tracker } from './tracker';

export class MetaGamerScore extends Tracker {
	name = 'MetaGamerScore';
	override signInLink = 'https://metagamerscore.com/users/sign_in?utm_campaign=userscript';

	userID?: string;

	override getProfileURL() {
		return `https://metagamerscore.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(game: Game) {
		if (!game.name) {
			return undefined;
		}

		if (!game.mgsId) {
			return `https://metagamerscore.com/my_games?user=${this.userID}&filter=${encodeURIComponent(game.name)}&utm_campaign=userscript`;
		}

		let urlFriendlyName = trim(game.name.toLowerCase().replace(/\W+/g, '-'), '-');

		return `https://metagamerscore.com/game/${game.mgsId}-${urlFriendlyName}?user=${this.userID}&utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const profileURL = this.getProfileURL();
		const redirectURL = await getRedirectURL(profileURL);
		this.userID = new URL(redirectURL).pathname.split('/')[2];

		let mgsGames: MgsGame[];

		try {
			const response = await getJSON<MgsGame[] | MgsError>(`https://metagamerscore.com/api/mygames/steam/${this.userID}?utm_campaign=userscript`);

			if (Array.isArray(response)) {
				mgsGames = response;
			} else {
				return { games: [], error: response.error };
			}
		} catch {
			return { games: [], signIn: true };
		}

		const games = mgsGames.map<Game>(game => {
			const unlocked = game.earned + game.earnedUnobtainable;
			const total = game.total + game.totalUnobtainable;

			return {
				appid: parseInt(game.appid),
				mgsId: game.mgs_id,
				name: game.name,
				unlocked,
				total,
				isPerfect: unlocked >= total,
				isCompleted: game.earned >= game.total ? true : undefined,
				isCounted: game.earned >= game.total,
				isTrusted: undefined,
			};
		});

		return { games };
	}

	override getRecoverLinkHTML() {
		return `
			<a class="whiteLink" href="https://metagamerscore.com/steam/index_reconcile?utm_campaign=userscript" target="_blank">
				Recover ${iconExternalLink}
			</a>`;
	}
}

interface MgsGame {
	mgs_id: number,
	name: string;
	appid: string;
	earned: number;
	total: number;
	earnedUnobtainable: number;
	totalUnobtainable: number;
}

interface MgsError {
	error: string;
	code: number;
}
