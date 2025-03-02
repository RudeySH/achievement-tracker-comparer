export const iconExternalLink =
	'<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif?utm_campaign=userscript" alt="" aria-hidden="true" />';

export const domParser = new DOMParser();

export async function getDocument(url: string, details?: Partial<GM.Request>) {
	const html = await getHTML(url, details);

	return domParser.parseFromString(html, 'text/html');
}

export async function getHTML(url: string, details?: Partial<GM.Request>) {
	const data = await xmlHttpRequest({
		method: 'GET',
		overrideMimeType: 'text/html',
		url,
		...details,
	});

	return data.responseText;
}

export async function getJSON<T = never>(url: string, details?: Partial<GM.Request>) {
	const data = await xmlHttpRequest({
		method: 'GET',
		overrideMimeType: 'application/json',
		url,
		...details,
	});

	return JSON.parse(data.responseText) as T;
}

export async function getRedirectURL(url: string) {
	const data = await xmlHttpRequest({
		method: 'GET',
		url,
	});

	return data.finalUrl;
}

export function xmlHttpRequest(details: GM.Request) {
	return retry(() => {
		console.debug(`${details.method} ${details.url}`);

		return new Promise<GM.Response<unknown>>((resolve, reject) => {
			GM.xmlHttpRequest({
				onabort: reject,
				onerror: reject,
				ontimeout: reject,
				onload: resolve,
				...details,
			});
		});
	});
}

export async function retry<T>(func: () => Promise<T>) {
	const attempts = 10;
	let error: unknown = undefined;

	for (let attempt = 1; attempt <= attempts; attempt++) {
		try {
			return await func();
		} catch (e) {
			if (attempt >= attempts) {
				error = e;
				break;
			}

			await delay(1000 * attempt);
			console.debug('Retrying...');
		}
	}

	throw error;
}

export function delay(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function mapBy<TKey, TITem>(items: TITem[], keySelector: (item: TITem) => TKey) {
	const map = new Map<TKey, TITem[]>();

	for (const item of items) {
		const key = keySelector(item);
		const values = map.get(key);

		if (values !== undefined) {
			values.push(item);
		} else {
			map.set(key, [item]);
		}
	}

	return map;
}

export function groupBy<TKey, TItem>(items: TItem[], keySelector: (item: TItem) => TKey) {
	const map = mapBy(items, keySelector);
	return [...map].map(([key, values]) => new Grouping<TKey, TItem>(key, values));
}

export class Grouping<TKey, TItem> extends Array<TItem> {
	key: TKey;

	constructor(key: TKey, items: TItem[]) {
		super(...items);
		this.key = key;
	}
}

export function merge<T extends object>(source: T, target: T | undefined): T {
	if (!target) {
		return source;
	}

	const source2 = Object.fromEntries(
		Object.entries(source).filter(([_, v]) => v !== undefined)
	);

	return Object.assign({... target }, source2);
}

export function trim(string: string, trim: string) {
	if (string.startsWith(trim)) {
		string = string.substring(trim.length);
	}

	if (string.endsWith(trim)) {
		string = string.substring(0, string.length - trim.length);
	}

	return string
}
