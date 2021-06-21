// ==UserScript==
// @name        Achievement Tracker Comparer
// @version     1.0.0
// @author      Rudey
// @description Compare achievements between AStats, completionist.me, Exophase, MetaGamerScore, Steam Hunters and Steam Community profiles.
// @homepage    https://github.com/RudeySH/achievement-tracker-comparer#readme
// @supportURL  https://github.com/RudeySH/achievement-tracker-comparer/issues
// @match       https://steamcommunity.com/id/*
// @match       https://steamcommunity.com/profiles/*
// @namespace   https://github.com/RudeySH/achievement-tracker-comparer
// @grant       GM.xmlHttpRequest
// @connect     astats.nl
// @connect     completionist.me
// @connect     exophase.com
// @connect     metagamerscore.com
// @connect     steamhunters.com
// @require     https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/he/1.2.0/he.min.js
// @downloadURL https://github.com/RudeySH/achievement-tracker-comparer/raw/main/dist/achievement-tracker-comparer.user.js
// @updateURL   https://github.com/RudeySH/achievement-tracker-comparer/raw/main/dist/achievement-tracker-comparer.meta.js
// ==/UserScript==

/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};

;// CONCATENATED MODULE: external "he"
const external_he_namespaceObject = he;
var external_he_default = /*#__PURE__*/__webpack_require__.n(external_he_namespaceObject);
;// CONCATENATED MODULE: ./src/utils/utils.ts
const domParser = new DOMParser();
async function getDocument(url, details) {
    const data = await xmlHttpRequest({
        method: 'GET',
        overrideMimeType: 'text/html',
        url,
        ...details,
    });
    return domParser.parseFromString(data.responseText, 'text/html');
}
async function getJSON(url, details) {
    const data = await xmlHttpRequest({
        method: 'GET',
        overrideMimeType: 'application/json',
        url,
        ...details,
    });
    return JSON.parse(data.responseText);
}
async function getRedirectURL(url) {
    const data = await xmlHttpRequest({
        method: 'HEAD',
        url,
    });
    return data.finalUrl;
}
function xmlHttpRequest(details) {
    console.log(`${details.method} ${details.url}`);
    return new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            onabort: reject,
            onerror: reject,
            ontimeout: reject,
            onload: resolve,
            ...details,
        });
    });
}

;// CONCATENATED MODULE: ./src/trackers/tracker.ts
class Tracker {
    constructor(steamid) {
        this.steamid = steamid;
    }
    validate(_game) {
        return [];
    }
}

;// CONCATENATED MODULE: ./src/trackers/astats.ts


class AStats extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'AStats';
    }
    getProfileURL() {
        return `https://astats.astats.nl/astats/User_Info.php?steamID64=${this.steamid}&utm_campaign=userscript`;
    }
    getGameURL(appid) {
        return `https://astats.astats.nl/astats/Steam_Game_Info.php?AppID=${appid}&SteamID64=${this.steamid}&utm_campaign=userscript`;
    }
    async getStartedGames() {
        const startedGames = [];
        const document = await getDocument(`https://astats.astats.nl/astats/User_Games.php?SteamID64=${this.steamid}&AchievementsOnly=1&Limit=0&utm_campaign=userscript`);
        const rows = document.querySelectorAll('table:not(.Pager) tbody tr');
        for (const row of rows) {
            const validUnlocked = parseInt(row.cells[2].textContent);
            const unlocked = validUnlocked + (parseInt(row.cells[3].textContent) || 0);
            if (unlocked <= 0) {
                continue;
            }
            const total = parseInt(row.cells[4].textContent);
            if (total <= 0) {
                continue;
            }
            const anchor = row.querySelector('a[href*="AppID="]');
            const appid = parseInt(new URL(anchor.href).searchParams.get('AppID'));
            const name = row.cells[1].textContent;
            const validTotal = row.cells[4].textContent.split(' - ').map(x => parseInt(x)).reduce((a, b) => a - b);
            const isPerfect = unlocked >= total;
            const isCompleted = isPerfect || validUnlocked > 0 && validUnlocked >= validTotal;
            const isCounted = isCompleted;
            const isTrusted = undefined;
            startedGames.push({ appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted });
        }
        return startedGames;
    }
    getRecoverLinkHTML() {
        return undefined;
    }
}

;// CONCATENATED MODULE: ./src/trackers/completionist.ts


class Completionist extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'completionist.me';
    }
    getProfileURL() {
        return `https://completionist.me/steam/profile/${this.steamid}?utm_campaign=userscript`;
    }
    getGameURL(appid) {
        return `https://completionist.me/steam/profile/${this.steamid}/app/${appid}?utm_campaign=userscript`;
    }
    async getStartedGames() {
        const startedGames = [];
        const url = `https://completionist.me/steam/profile/${this.steamid}/apps?display=flat&sort=started&order=asc&completion=started&utm_campaign=userscript`;
        const document = await this.addStartedGames(startedGames, url);
        const lastPageAnchor = document.querySelector('.pagination a:last-of-type');
        if (lastPageAnchor !== null) {
            const pageCount = parseInt(new URL(lastPageAnchor.href).searchParams.get('page'));
            const iterator = this.getStartedGamesIterator(startedGames, url, pageCount);
            const pool = new PromisePool(iterator, 6);
            await pool.start();
        }
        return startedGames;
    }
    *getStartedGamesIterator(startedGames, url, pageCount) {
        for (let page = 2; page <= pageCount; page++) {
            yield this.addStartedGames(startedGames, `${url}&page=${page}`);
        }
    }
    async addStartedGames(startedGames, url) {
        var _a;
        const document = await getDocument(url);
        const rows = document.querySelectorAll('.games-list tbody tr');
        for (const row of rows) {
            const nameCell = row.cells[1];
            const anchor = nameCell.querySelector('a');
            const counts = row.cells[4].textContent.split('/').map(s => parseInt(s.replace(',', '')));
            const unlocked = counts[0];
            const total = (_a = counts[1]) !== null && _a !== void 0 ? _a : unlocked;
            const isPerfect = unlocked >= total;
            startedGames.push({
                appid: parseInt(anchor.href.substr(anchor.href.lastIndexOf('/') + 1)),
                name: nameCell.textContent.trim(),
                unlocked,
                total,
                isPerfect,
                isCompleted: isPerfect ? true : undefined,
                isCounted: isPerfect,
                isTrusted: nameCell.querySelector('.fa-spinner') === null,
            });
        }
        return document;
    }
    getRecoverLinkHTML(games) {
        return `
			<form method="post" action="https://completionist.me/steam/recover/profile" target="_blank">
				<input type="hidden" name="app_ids" value="${games.map(game => game.appid)}">
				<input type="hidden" name="profile_id" value="${this.steamid}">
				<button type="submit" class="whiteLink">
					Recover
					<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
				</button>
			</form>`;
    }
}

;// CONCATENATED MODULE: ./src/trackers/exophase.ts


class Exophase extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'Exophase';
    }
    getProfileURL() {
        return `https://www.exophase.com/steam/id/${this.steamid}?utm_campaign=userscript`;
    }
    getGameURL(appid) {
        return `https://www.exophase.com/steam/game/id/${appid}/stats/${this.steamid}?utm_campaign=userscript`;
    }
    async getStartedGames() {
        const credentials = await getJSON(`https://www.exophase.com/account/token`);
        const overview = await getJSON(`https://api.exophase.com/account/games?filter=steam&utm_campaign=userscript`, { headers: { 'Authorization': `Bearer ${credentials.token}` } });
        return overview.games['steam'].map(game => ({
            appid: parseInt(game.canonical_id),
            name: game.title,
            unlocked: game.earned_awards,
            total: game.total_awards,
            isPerfect: game.earned_awards >= game.total_awards,
            isCompleted: game.earned_awards >= game.total_awards ? true : undefined,
            isCounted: game.earned_awards >= game.total_awards,
            isTrusted: undefined,
        }));
    }
    getRecoverLinkHTML() {
        return `
			<a class="whiteLink" href="https://www.exophase.com/account/#tools" target="_blank">
				Recover
				<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
			</a>`;
    }
}

;// CONCATENATED MODULE: ./src/trackers/metagamerscore.ts


class MetaGamerScore extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'MetaGamerScore';
    }
    getProfileURL() {
        return `https://metagamerscore.com/steam/id/${this.steamid}?utm_campaign=userscript`;
    }
    getGameURL() {
        return undefined;
    }
    async getStartedGames() {
        const startedGames = [];
        const profileURL = this.getProfileURL();
        const redirectURL = await getRedirectURL(profileURL);
        const user = parseInt(new URL(redirectURL).pathname.split('/')[2]);
        const gamesURL = `https://metagamerscore.com/my_games?user=${user}&utm_campaign=userscript`;
        const document = await this.addStartedGames(startedGames, gamesURL);
        const lastPageAnchor = document.querySelector('.last a');
        if (lastPageAnchor !== null) {
            const pageCount = parseInt(new URL(lastPageAnchor.href).searchParams.get('page'));
            const iterator = this.getStartedGamesIterator(startedGames, gamesURL, pageCount);
            const pool = new PromisePool(iterator, 6);
            await pool.start();
        }
        return startedGames;
    }
    *getStartedGamesIterator(startedGames, url, pageCount) {
        for (let page = 2; page <= pageCount; page++) {
            yield this.addStartedGames(startedGames, `${url}&page=${page}`);
        }
    }
    async addStartedGames(startedGames, url) {
        const document = await getDocument(url, { headers: { 'Cookie': `hide_pfs=[1,3,4,5,6,7,8,9,10,11,12,13,14]` } });
        const thumbs = document.querySelectorAll('#masonry-container > div');
        for (const thumb of thumbs) {
            const tag = thumb.querySelector('.pfSm');
            if (!tag.classList.contains('pfTSteam')) {
                console.warn(tag.title);
                continue;
            }
            const [unlocked, total] = [...thumb.querySelectorAll('.completiondata')]
                .map(completiondata => parseInt(completiondata.textContent.replace(' ', '')));
            if (!(unlocked > 0)) {
                continue;
            }
            const isPerfect = unlocked >= total;
            const imagePath = thumb.querySelector('.gt_image').src
                .replace('https://steamcdn-a.akamaihd.net/steam/apps/', '')
                .replace('https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/', '');
            startedGames.push({
                appid: parseInt(imagePath.split('/')[0]),
                name: thumb.querySelector('.sort_gt_tt a').textContent.trim(),
                unlocked,
                total,
                isPerfect,
                isCompleted: isPerfect ? true : undefined,
                isCounted: isPerfect,
                isTrusted: undefined,
            });
        }
        return document;
    }
    getRecoverLinkHTML() {
        return `
			<a class="whiteLink" href="https://metagamerscore.com/steam/index_reconcile" target="_blank">
				Recover
				<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
			</a>`;
    }
}

;// CONCATENATED MODULE: ./src/trackers/steam.ts


class Steam extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'Steam';
    }
    getProfileURL() {
        return unsafeWindow.g_rgProfileData.steamid === this.steamid
            ? unsafeWindow.g_rgProfileData.url.substr(0, unsafeWindow.g_rgProfileData.url.length - 1)
            : `https://steamcommunity.com/profiles/${this.steamid}`;
    }
    getGameURL(appid) {
        return `${this.getProfileURL()}/stats/${appid}?tab=achievements`;
    }
    async getStartedGames(appids) {
        const document = await getDocument(`${this.getProfileURL()}/edit/showcases`);
        const achievementShowcaseGames = JSON.parse(document.getElementById('showcase_preview_17').innerHTML.match(/g_rgAchievementShowcaseGamesWithAchievements = (.*);/)[1]);
        const completionistShowcaseGames = JSON.parse(document.getElementById('showcase_preview_23').innerHTML.match(/g_rgAchievementsCompletionshipShowcasePerfectGames = (.*);/)[1]);
        appids = [...new Set([
                ...appids,
                ...achievementShowcaseGames.map(game => game.appid),
                ...completionistShowcaseGames.map(game => game.appid),
            ])];
        const startedGames = [];
        const iterator = this.getStartedGamesIterator(appids, achievementShowcaseGames, completionistShowcaseGames, startedGames);
        const pool = new PromisePool(iterator, 6);
        await pool.start();
        return startedGames;
    }
    *getStartedGamesIterator(appids, achievementShowcaseGames, completionistShowcaseGames, startedGames) {
        for (const appid of appids) {
            yield this.getGame(appid, achievementShowcaseGames, completionistShowcaseGames).then(game => startedGames.push(game));
        }
    }
    async getGame(appid, achievementShowcaseGames, completionistShowcaseGames) {
        var _a;
        if (appid === 247750) {
            const name = 'The Stanley Parable Demo';
            const unlocked = await this.getAchievementShowcaseCount(appid);
            const isPerfect = unlocked === 1;
            return { appid, name, unlocked, total: 1, isPerfect, isCompleted: isPerfect, isCounted: isPerfect, isTrusted: true };
        }
        const completionistShowcaseGame = completionistShowcaseGames.find(game => game.appid === appid);
        let { unlocked, total } = await this.getFavoriteGameShowcaseCounts(appid);
        total !== null && total !== void 0 ? total : (total = completionistShowcaseGame === null || completionistShowcaseGame === void 0 ? void 0 : completionistShowcaseGame.num_achievements);
        if (unlocked === undefined) {
            unlocked = await this.getAchievementShowcaseCount(appid);
            if (unlocked === 9999 && completionistShowcaseGame !== undefined) {
                unlocked = completionistShowcaseGame.num_achievements;
            }
        }
        const achievementShowcaseGame = achievementShowcaseGames.find(game => game.appid === appid);
        const name = (_a = achievementShowcaseGame === null || achievementShowcaseGame === void 0 ? void 0 : achievementShowcaseGame.name) !== null && _a !== void 0 ? _a : completionistShowcaseGame === null || completionistShowcaseGame === void 0 ? void 0 : completionistShowcaseGame.name;
        const isPerfect = total !== undefined ? unlocked >= total : undefined;
        const isCompleted = isPerfect ? true : undefined;
        const isCounted = completionistShowcaseGame !== undefined;
        const isTrusted = achievementShowcaseGame !== undefined;
        return { appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted };
    }
    async getFavoriteGameShowcaseCounts(appid) {
        const body = new FormData();
        body.append('customization_type', '6');
        body.append('sessionid', unsafeWindow.g_sessionID);
        body.append('slot_data', `{"0":{"appid":${appid}}}`);
        const url = `${this.getProfileURL()}/ajaxpreviewshowcase`;
        const attempts = 3;
        let error = undefined;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const response = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
                const text = await response.text();
                const template = document.createElement('template');
                template.innerHTML = text.replace(/src="[^"]+"/g, '');
                const ellipsis = template.content.querySelector('.ellipsis');
                let unlocked = undefined;
                let total = undefined;
                if (ellipsis !== null) {
                    const split = ellipsis.textContent.split(/\D+/).filter(s => s !== '');
                    unlocked = parseInt(split[0]);
                    total = parseInt(split[1]);
                }
                return { unlocked, total };
            }
            catch (e) {
                if (attempt >= attempts) {
                    error = e;
                    break;
                }
                await delay(1000 * attempt);
            }
        }
        throw error;
    }
    async getAchievementShowcaseCount(appid) {
        var _a;
        const url = `${this.getProfileURL()}/ajaxgetachievementsforgame/${appid}`;
        const attempts = 3;
        let error = undefined;
        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const response = await fetch(url);
                const text = await response.text();
                const template = document.createElement('template');
                template.innerHTML = text;
                const list = template.content.querySelector('.achievement_list');
                if (list === null) {
                    const h3 = template.content.querySelector('h3');
                    throw new Error((_a = h3 === null || h3 === void 0 ? void 0 : h3.textContent) !== null && _a !== void 0 ? _a : `Response is invalid: ${url}`);
                }
                return list.querySelectorAll('.achievement_list_item').length;
            }
            catch (e) {
                if (attempt >= attempts) {
                    error = e;
                    break;
                }
                await delay(1000 * attempt);
            }
        }
        throw error;
    }
    getRecoverLinkHTML() {
        return undefined;
    }
    validate(game) {
        const messages = [];
        if (game.isCounted === true) {
            if (game.isPerfect === false) {
                messages.push(`counted but not perfect on Steam`);
            }
            if (game.isTrusted === false) {
                messages.push(`counted but not trusted on Steam`);
            }
        }
        else {
            if (game.isPerfect === true && game.isTrusted === true) {
                messages.push(`perfect & trusted but not counted on Steam`);
            }
        }
        return messages;
    }
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

;// CONCATENATED MODULE: ./src/trackers/steam-hunters.ts



class SteamHunters extends Tracker {
    constructor() {
        super(...arguments);
        this.name = 'Steam Hunters';
    }
    getProfileURL() {
        return `https://steamhunters.com/profiles/${this.steamid}?utm_campaign=userscript`;
    }
    getGameURL(appid) {
        return `https://steamhunters.com/profiles/${this.steamid}/stats/${appid}?utm_campaign=userscript`;
    }
    async getStartedGames() {
        const licenses = await getJSON(`https://steamhunters.com/api/steam-users/${this.steamid}/licenses?state=started&utm_campaign=userscript`);
        return Object.entries(licenses).map(([appid, license]) => ({
            appid: parseInt(appid),
            name: license.app.name,
            unlocked: license.achievementUnlockCount,
            total: license.app.achievementCount,
            isPerfect: license.achievementUnlockCount >= license.app.achievementCount,
            isCompleted: license.isCompleted,
            isCounted: license.isCompleted && !license.isInvalidated,
            isTrusted: !license.app.isRestricted,
        }));
    }
    getRecoverLinkHTML(games) {
        return `
			<form method="post" action="https://steamhunters.com/profiles/${this.steamid}/recover" target="_blank">
				<input type="hidden" name="version" value="2.0">
				<input type="hidden" name="apps" value="${external_he_default().escape(JSON.stringify(games))}">
				<button type="submit" class="whiteLink">
					Recover
					<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
				</button>
			</form>`;
    }
}

;// CONCATENATED MODULE: ./src/index.ts







const steamid = unsafeWindow.g_rgProfileData.steamid;
const isOwnProfile = unsafeWindow.g_steamID === steamid;
const trackers = [
    new AStats(steamid),
    new Completionist(steamid),
    new Exophase(steamid),
    new MetaGamerScore(steamid),
    new SteamHunters(steamid),
];
window.addEventListener('load', () => {
    const container = document.querySelector('.profile_rightcol');
    if (container === null) {
        return;
    }
    const style = document.createElement('style');
    style.innerHTML = `
		.atc button {
			border: none;
		}

		.atc button:disabled {
			pointer-events: none;
		}

		.atc button.whiteLink {
			background-color: transparent;
			font-size: inherit;
			padding: 0;
		}

		.atc form {
			display: inline;
		}

		.atc input[type="checkbox"] {
			vertical-align: top;
		}

		.atc textarea {
			font-size: inherit;
			overflow-y: scroll;
		}

		.atc .profile_comment_area {
			margin-top: 0;
		}`;
    document.head.appendChild(style);
    const template = document.createElement('template');
    template.innerHTML = `
		<div class="atc">
			<div class="profile_item_links">
				<form>
					<div class="profile_count_link ellipsis">
						<a>
							<span class="count_link_label">Achievement Trackers</span>&nbsp;
							<span class="profile_count_link_total">${trackers.length}</span>
						</a>
					</div>
					${trackers.map(tracker => `<div>
							<label>
								<input type="checkbox" name="trackerName" value="${tracker.name}" />
								${tracker.name}
							</label>
							<a class="whiteLink" href="${tracker.getProfileURL()}" target="_blank">
								<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
							</a>
						</div>`).join('')}
					<p ${isOwnProfile ? '' : 'hidden'}>
						<label>
							<input type="checkbox" name="trackerName" value="Steam" />
							Steam profile showcases (slow)
						</label>
					</p>
					<p>
						<button type="button" class="btn_profile_action btn_medium" id="atc_btn" disabled>
							<span>Find Differences</span>
						</button>
						<span id="atc_counter">0</span>
						selected
					</p>
				</form>
				<div id="atc_output"></div>
			</div>
		</div>`;
    const node = document.importNode(template.content, true);
    const form = node.querySelector('form');
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    const button = form.querySelector('button#atc_btn');
    const buttonSpan = button.querySelector('span');
    const counter = form.querySelector('#atc_counter');
    const output = node.querySelector('#atc_output');
    form.addEventListener('change', () => {
        const formData = new FormData(form);
        const trackerNames = formData.getAll('trackerName');
        button.disabled = trackerNames.length < 2;
        counter.textContent = trackerNames.length.toString();
    });
    button.addEventListener('click', async () => {
        const formData = new FormData(form);
        const trackerNames = formData.getAll('trackerName');
        button.disabled = true;
        buttonSpan.textContent = 'Loading...';
        for (const checkbox of checkboxes) {
            checkbox.disabled = true;
        }
        try {
            await findDifferences(trackerNames, output);
        }
        catch (reason) {
            console.error(reason);
        }
        buttonSpan.textContent = 'Find Differences';
        button.disabled = false;
        for (const checkbox of checkboxes) {
            checkbox.disabled = false;
        }
    });
    container.appendChild(node);
});
async function findDifferences(trackerNames, output) {
    var _a;
    output.innerHTML = '';
    let results = await Promise.all(trackers
        .filter(tracker => trackerNames.includes(tracker.name))
        .map(async (tracker) => ({ tracker, games: await tracker.getStartedGames() })));
    if (trackerNames.includes('Steam')) {
        const appids = new Set();
        results.forEach(result => result.games.forEach(game => appids.add(game.appid)));
        const tracker = new Steam(steamid);
        results.push({ tracker, games: await tracker.getStartedGames([...appids]) });
    }
    results = results.filter(result => result.games.length !== 0);
    if (results.length < 2) {
        return;
    }
    output.innerHTML = `
		<div class="profile_comment_area">
			${results.filter(result => result.tracker.name !== 'Steam').map(result => {
        let missingGames = results
            .filter(otherResult => otherResult !== result)
            .flatMap(otherResult => otherResult.games
            .filter(otherGame => {
            var _a;
            const game = result.games.find(game => game.appid === otherGame.appid);
            return otherGame.unlocked > ((_a = game === null || game === void 0 ? void 0 : game.unlocked) !== null && _a !== void 0 ? _a : 0);
        }));
        // remove duplicates
        missingGames = [...new Map(missingGames.map(g => [g.appid, g])).values()];
        const recoverGames = missingGames.map(g => ({ appid: g.appid, unlocked: g.unlocked, total: g.total }));
        const recoverLinkHTML = isOwnProfile ? result.tracker.getRecoverLinkHTML(recoverGames) : undefined;
        let html = `
					<div style="margin-top: 1em;">
						<a class="whiteLink" href="${result.tracker.getProfileURL()}" target="_blank">
							${result.tracker.name}
							<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
						</a>
					</div>`;
        if (missingGames.length === 0) {
            html += `
						<span style="color: #90ba3c;">
							✔ Up to Date
						</span>`;
        }
        else {
            const missingAchievementsSum = missingGames.map(g => g.unlocked).reduce((a, b) => a + b); // TODO
            const names = missingGames.map(g => { var _a; return (_a = g.name) !== null && _a !== void 0 ? _a : `Unknown App ${g.appid}`; }).sort((a, b) => a < b ? -1 : 1).map(a => external_he_default().escape(a)).join('; ');
            html += `
						<span style="color: #b33b32;">
							✖ Missing ${missingAchievementsSum} Achievement${missingAchievementsSum !== 1 ? 's' : ''}
							in ${missingGames.length} Game${missingGames.length !== 1 ? 's' : ''}
						</span>
						<div class="commentthread_entry_quotebox">
							<textarea class="commentthread_textarea" readonly rows="3">${names}</textarea>
						</div>
						<div style="font-size: 11px;">
							<a class="whiteLink" data-copy="${missingGames.map(g => g.appid)}">
								Copy App IDs
							</a>
							&bull;
							<a class="whiteLink" data-copy="${external_he_default().escape(JSON.stringify({ version: '2.0', apps: recoverGames }))}">
								Copy JSON
							</a>
							${recoverLinkHTML === undefined ? '' : `
								&bull;
								${recoverLinkHTML}
							`}
						</div>`;
        }
        return html;
    }).join('')}
		</div>`;
    for (const anchor of output.querySelectorAll('a[data-copy]')) {
        anchor.addEventListener('click', async function () {
            await navigator.clipboard.writeText(this.dataset['copy']);
            alert('Copied to clipboard.');
        });
    }
    for (let sourceIndex = 0; sourceIndex < results.length; sourceIndex++) {
        const source = results[sourceIndex];
        const validationErrors = [];
        for (const game of source.games) {
            const messages = source.tracker.validate(game);
            if (messages.length !== 0) {
                validationErrors.push({ name: (_a = game.name) !== null && _a !== void 0 ? _a : `Unknown App ${game.appid}`, messages: messages.join(', ') });
            }
        }
        // TODO: display validation errors on screen instead of logging to console
        if (validationErrors.length !== 0) {
            console.log(`Validation errors on ${source.tracker.name}:`);
            console.table(validationErrors);
        }
        for (let targetIndex = sourceIndex + 1; targetIndex < results.length; targetIndex++) {
            const target = results[targetIndex];
            // join games from both trackers into map
            const gamesMap = new Map();
            for (const game of source.games) {
                gamesMap.set(game.appid, { source: game });
            }
            for (const game of target.games) {
                let value = gamesMap.get(game.appid);
                if (value === undefined) {
                    value = {};
                    gamesMap.set(game.appid, value);
                }
                value.target = game;
            }
            // convert map into array
            const games = [...gamesMap].map(([appid, game]) => {
                var _a, _b, _c, _d;
                game.appid = appid;
                game.name = (_d = (_b = (_a = game.source) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : (_c = game.target) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : `Unknown App ${appid}`;
                return game;
            });
            const differences = [];
            for (const game of games) {
                const messages = [];
                if (game.source === undefined) {
                    messages.push(`missing on ${source.tracker.name}`);
                }
                else if (game.target === undefined) {
                    messages.push(`missing on ${target.tracker.name}`);
                }
                else {
                    if (game.source.unlocked > game.target.unlocked) {
                        messages.push(`+${game.source.unlocked - game.target.unlocked} unlocked on ${source.tracker.name}`);
                    }
                    else if (game.target.unlocked > game.source.unlocked) {
                        messages.push(`+${game.target.unlocked - game.source.unlocked} unlocked on ${target.tracker.name}`);
                    }
                    else if (game.source.isPerfect === true && game.target.isPerfect === false) {
                        messages.push(`perfect on ${source.tracker.name} but not on ${target.tracker.name}`);
                    }
                    else if (game.target.isPerfect === true && game.source.isPerfect === false) {
                        messages.push(`perfect on ${target.tracker.name} but not on ${source.tracker.name}`);
                    }
                    else if (game.source.isCompleted === true && game.target.isCompleted === false) {
                        messages.push(`completed on ${source.tracker.name} but not on ${target.tracker.name}`);
                    }
                    else if (game.target.isCompleted === true && game.source.isCompleted === false) {
                        messages.push(`completed on ${target.tracker.name} but not on ${source.tracker.name}`);
                    }
                    else if (game.source.isCounted === true && game.target.isCounted === false) {
                        messages.push(`counts on ${source.tracker.name} but not on ${target.tracker.name}`);
                    }
                    else if (game.target.isCounted === true && game.source.isCounted === false) {
                        messages.push(`counts on ${target.tracker.name} but not on ${source.tracker.name}`);
                    }
                    if (game.source.isTrusted === true && game.target.isTrusted === false) {
                        messages.push(`trusted on ${source.tracker.name} but not on ${target.tracker.name}`);
                    }
                    else if (game.target.isTrusted === true && game.source.isTrusted === false) {
                        messages.push(`trusted on ${target.tracker.name} but not on ${source.tracker.name}`);
                    }
                }
                if (messages.length !== 0) {
                    differences.push({
                        appid: game.appid,
                        name: game.name,
                        messages: messages.join('; '),
                        sourceURL: source.tracker.getGameURL(game.appid),
                        targetURL: target.tracker.getGameURL(game.appid),
                    });
                }
            }
            // TODO: display differences on screen instead of logging to console
            if (differences.length === 0) {
                console.log(`No differences between ${source.tracker.name} and ${target.tracker.name}.`);
                continue;
            }
            differences.sort((a, b) => a.appid - b.appid);
            console.log(`Differences between ${source.tracker.name} and ${target.tracker.name}:`);
            if (differences.length <= 100) {
                console.table(differences);
            }
            const csv = `App ID,Name,Differences,${source.tracker.name} URL,${target.tracker.name} URL\n`
                + differences.map(d => `${d.appid},${escapeCSV(d.name)},${d.messages},${d.sourceURL},${d.targetURL}`).join('\n');
            console.log(csv);
        }
    }
}
function escapeCSV(string) {
    if (string.indexOf('"') !== -1) {
        return `"${string.replace(/"/g, '""')}"`;
    }
    else if (string.indexOf(',') !== -1) {
        return `"${string}"`;
    }
    return string;
}

/******/ })()
;