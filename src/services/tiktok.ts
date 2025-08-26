import { VT_TIKTOK_REGEX } from '@/regexes.js';
import got from 'got';

const TIKTOK_API_URL = 'https://tdl.hanifu.id/api/download';

export const fetchTiktokVideo = async (url: string, retry = 0): Promise<string[]> => {
	const response = await got
		.get(TIKTOK_API_URL, {
			searchParams: new URLSearchParams({
				url,
			}),
			retry: {
				limit: 5,
				statusCodes: [500, 521],
			},
		})
		.json<{
			error?: string;
			video?: {
				urls: string[];
			};
		}>();

	if (response.error && retry < 3) {
		return fetchTiktokVideo(url, retry + 1);
	}

	return response.video?.urls ?? [];
};

export function getTikTokURL(url: string): string | undefined {
	try {
		if (VT_TIKTOK_REGEX.test(url)) {
			const u = new URL(url);
			u.search = ''; // cleanup params
			return u.href;
		}

		return undefined;
	} catch {
		return undefined;
	}
}
