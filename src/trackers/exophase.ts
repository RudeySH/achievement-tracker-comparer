import { Game } from '../interfaces/game';
import { getJSON, iconExternalLink } from '../utils/utils';
import { Tracker } from './tracker';

export class Exophase extends Tracker {
	name = 'Exophase';
	override signInLink = 'https://www.exophase.com/login/?utm_campaign=userscript';
	override ownProfileOnly = true;

	override getProfileURL() {
		return `https://www.exophase.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(appid: number) {
		return `https://www.exophase.com/steam/game/id/${appid}/stats/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override async getStartedGames() {
		let credentials: Credentials;
		try {
			credentials = await getJSON<Credentials>('https://www.exophase.com/account/token?utm_campaign=userscript');
		} catch {
			console.error('Unable to retrieve Exophase access token. Are you signed in on Exophase.com?');
			return { games: [], signIn: true };
		}

		const overview = await getJSON<Overview>(
			'https://api.exophase.com/account/games?filter=steam&utm_campaign=userscript',
			{ headers: { 'Authorization': `Bearer ${credentials.token}` } });

		if (overview.services.find(s => s.environment === 'steam')?.canonical_id !== this.profileData.steamid) {
			return { games: [], signIn: true, signInAs: this.profileData.personaname };
		}

		const games = overview.games['steam'].map<Game>(game => ({
			appid: parseInt(game.canonical_id),
			name: game.title,
			unlocked: game.earned_awards,
			total: game.total_awards,
			isPerfect: game.earned_awards >= game.total_awards,
			isCompleted: game.earned_awards >= game.total_awards ? true : undefined,
			isCounted: game.earned_awards >= game.total_awards,
			isTrusted: undefined,
		}));

		return { games };
	}

	override getRecoverLinkHTML() {
		return `
			<a class="whiteLink" href="https://www.exophase.com/account/?utm_campaign=userscript#tools" target="_blank">
				Recover ${iconExternalLink}
			</a>`;
	}
}

interface Credentials {
	token: string;
}

interface ExoGame {
	total_awards: number;
	canonical_id: string;
	master_id: number;
	earned_awards: number;
	earned_points: number;
	lastplayed: number;
	completion_date: number;
	title: string;
}

interface Overview {
	success: boolean;
	services: Service[];
	games: { [environment: string]: ExoGame[] };
}

interface Service {
	canonical_id: string;
	environment: string;
}
