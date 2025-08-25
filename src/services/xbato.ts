import got from 'got';

export const XBATO_API_URL = 'https://xbato-api.hanifu.id';

export const searchBato = async (query: string) => {
	const response = await got(new URL('./search', XBATO_API_URL), {
		searchParams: new URLSearchParams({ query }),
	}).json<{
		data: Array<{
			url: string;
			title: string;
			languages: {
				original: string;
				translation: string;
			};
		}>;
	}>();

	return response.data;
};

export const fetchBato = async (url: string) => {
	const base64Url = Buffer.from(url).toString('base64');
	const response = await got(new URL(`./comic/${base64Url}`, XBATO_API_URL)).json<{
		data?: {
			prose: string;
			chapters: Array<{
				name: string;
				chapter: string;
				url: string;
			}>;
		};
	}>();

	return response.data;
};

export const fetchBatoImages = async (url: string) => {
	const base64Url = Buffer.from(url).toString('base64');
	const response = await got(new URL(`./images/${base64Url}`, XBATO_API_URL)).json<{
		data: Array<string>;
	}>();

	return response.data;
};
