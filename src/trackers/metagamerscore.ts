import { Game } from '../interfaces/game';
import { getJSON, getRedirectURL, iconExternalLink } from '../utils/utils';
import { Tracker } from './tracker';

export class MetaGamerScore extends Tracker {
	name = 'MetaGamerScore';
	override signInLink = 'https://metagamerscore.com/users/sign_in?utm_campaign=userscript';

	userID?: string;

	override getProfileURL() {
		return `https://metagamerscore.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(_appid: number, name: string | undefined) {
		if (this.userID === undefined || name === undefined) {
			return undefined;
		}

		return `https://metagamerscore.com/my_games?user=${this.userID}&filter=${encodeURIComponent(name)}&utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const profileURL = this.getProfileURL();
		const redirectURL = await getRedirectURL(profileURL);
		this.userID = new URL(redirectURL).pathname.split('/')[2];

		let mgsGames: MetaGamerScoreGame[];

		try {
			mgsGames = await getJSON<MetaGamerScoreGame[]>(`https://metagamerscore.com/api/mygames/steam/${this.userID}?utm_campaign=userscript`);
		} catch {
			console.error('Unable to retrieve MetaGamerScore games. Are you signed in on MetaGamerScore.com?');
			return { games: [], signIn: true };
		}

		const games = mgsGames.map<Game>(game => ({
			appid: parseInt(game.appid),
			name: game.name,
			unlocked: game.earned,
			total: game.total,
			isPerfect: game.earned >= game.total,
			isCompleted: game.earned >= game.total ? true : undefined,
			isCounted: game.earned >= game.total,
			isTrusted: undefined,
		}));

		return { games };
	}

	override getRecoverLinkHTML() {
		return `
			<a class="whiteLink" href="https://metagamerscore.com/steam/index_reconcile?utm_campaign=userscript" target="_blank">
				Recover ${iconExternalLink}
			</a>`;
	}
}

interface MetaGamerScoreGame {
	name: string;
	appid: string;
	earned: number;
	total: number;
}
