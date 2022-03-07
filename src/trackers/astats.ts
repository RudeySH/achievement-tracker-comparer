import { Game } from '../interfaces/game';
import { getDocument } from '../utils/utils';
import { Tracker } from './tracker';

export class AStats extends Tracker {
	name = 'AStats';

	override getProfileURL() {
		return `https://astats.astats.nl/astats/User_Info.php?steamID64=${this.profileData.steamid}&utm_campaign=userscript`;
	}

	override getGameURL(game: Game) {
		return `https://astats.astats.nl/astats/Steam_Game_Info.php?AppID=${game.appid}&SteamID64=${this.profileData.steamid}&utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const games: Game[] = [];
		const doc = await getDocument(`https://astats.astats.nl/astats/User_Games.php?Limit=0&Hidden=1&AchievementsOnly=1&SteamID64=${this.profileData.steamid}&utm_campaign=userscript`);
		const rows = doc.querySelectorAll<HTMLTableRowElement>('table:not(.Pager) tbody tr');

		for (const row of rows) {
			const validUnlocked = parseInt(row.cells[2].textContent!);
			const unlocked = validUnlocked + (parseInt(row.cells[3].textContent!) || 0);

			if (unlocked <= 0) {
				continue;
			}

			const total = parseInt(row.cells[4].textContent!);

			if (total <= 0) {
				continue;
			}

			const anchor = row.querySelector<HTMLAnchorElement>('a[href*="AppID="]')!;
			const appid = parseInt(new URL(anchor.href).searchParams.get('AppID')!);
			const name = row.cells[1].textContent!;
			const validTotal = row.cells[4].textContent!.split(' - ').map(x => parseInt(x)).reduce((a, b) => a - b);
			const isPerfect = unlocked >= total;
			const isCompleted = isPerfect || validUnlocked > 0 && validUnlocked >= validTotal;
			const isCounted = isCompleted;
			const isTrusted = undefined;

			games.push({ appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted });
		}

		return { games };
	}

	override getRecoverLinkHTML() {
		return undefined;
	}
}
