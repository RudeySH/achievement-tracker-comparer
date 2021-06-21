import { Game } from '../interfaces/game';
import { getJSON } from '../utils/utils';
import { Tracker } from './tracker';

export class Exophase extends Tracker {
	name = 'Exophase';
	signInRequired = true;

	override getProfileURL() {
		return `https://www.exophase.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(appid: number) {
		return `https://www.exophase.com/steam/game/id/${appid}/stats/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const message = `
			<a class="whiteLink" href="https://www.exophase.com/login/" target="_blank">
				Sign in <img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
			</a>`

		let credentials: Credentials;
		try {
			credentials = await getJSON<Credentials>(`https://www.exophase.com/account/token?utm_campaign=userscript`);
		} catch {
			return { games: [], message };
		}

		const overview = await getJSON<Overview>(
			`https://api.exophase.com/account/games?filter=steam&utm_campaign=userscript`,
			{ headers: { 'Authorization': `Bearer ${credentials.token}` } });

		if (overview.services.find(s => s.environment === 'steam')?.canonical_id !== this.profileData.steamid) {
			return { games: [], message: `${message} as ${this.profileData.personaname}` };
		}

		const games = overview.games['steam']
			.map<Game>(game => ({
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
			<a class="whiteLink" href="https://www.exophase.com/account/#tools" target="_blank">
				Recover
				<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
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
