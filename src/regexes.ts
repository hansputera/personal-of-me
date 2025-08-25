export const VT_TIKTOK_REGEX =
	/^(?:https?:\/\/)?(?:www\.|m\.)?(?:tiktok\.com\/@[^\/\s]+\/video\/(\d+)|tiktok\.com\/t\/([A-Za-z0-9_-]+)|vm\.tiktok\.com\/([A-Za-z0-9_-]+))(?:[\/?].*)?$/i;

export const XBATO_REGEX =
	/^https?:\/\/(?:www\.)?xbato\.com\/title\/(\d+)(?:-([A-Za-z0-9\-\_%]+))?\/?$/g;
export const XBATO_CHAPTER_REGEX =
	/https?:\/\/(?:www\.)?xbato\.com\/title\/\d+(?:-[A-Za-z0-9\-\_%]+)?\/(\d+)-ch_(\d+)\/?/g;

export const NORMALIZED_ID_REGEX = /:\d+(?=@)/;
