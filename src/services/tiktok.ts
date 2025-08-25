import got from 'got';

const TIKTOK_API_URL = 'https://tdl.hanifu.id/api/download';

export const fetchTiktokVideo = async (url: string, retry = 0): Promise<string[]> => {
	const response = await got
		.get(TIKTOK_API_URL, {
			searchParams: new URLSearchParams({
				url,
			}),
			retry: {
				limit: 3,
				statusCodes: [500],
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
