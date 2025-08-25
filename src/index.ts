import WAWeb from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { rm, stat } from 'node:fs/promises';
import prettyMs from 'pretty-ms';
import { VT_TIKTOK_REGEX, XBATO_CHAPTER_REGEX, XBATO_REGEX } from './regexes.js';
import { fetchTiktokVideo } from './services/tiktok.js';
import { findChrome } from 'find-chrome-bin';
import { fetchBato, fetchBatoImages, searchBato } from './services/xbato.js';
import { imagesToPdf } from './services/pdfs.js';

const chromeInfo = await findChrome({});
const client = new WAWeb.Client({
	authStrategy: new WAWeb.LocalAuth({
		dataPath: 'wa_session',
	}),
	puppeteer: {
		executablePath: chromeInfo.executablePath,
		args: ['--no-sandbox'],
		headless: true,
	},
	webVersionCache: {
		remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/refs/heads/main/html/2.3000.1026281893-alpha.html',
		type: 'remote',
	},
});

client.on('qr', (qr) => {
	console.log('QR file generated....');
	qrcode.toFile('qr.png', qr, (err) => {
		if (err) {
			throw err;
		}
	});
});

client.on('ready', async () => {
	// Check if qr file exists
	const qrStat = await stat('qr.png').catch(() => undefined);
	if (qrStat) {
		await rm('qr.png');
	}

	console.log(`Logged in as: ${client.info.wid.user}`);
});

client.on('message_create', async (message) => {
	if (message.fromMe && !message.body.startsWith('[BOT]')) {
		if (message.body === '--bypass' && message.hasQuotedMsg) {
			const quotedMessage = await message.getQuotedMessage();
			message.body = quotedMessage.body;
		}

		// TikTok feature
		const tiktokUrl = VT_TIKTOK_REGEX.exec(message.body)?.at(0);
		if (tiktokUrl) {
			const tiktokCdnUrls = await fetchTiktokVideo(tiktokUrl).catch(() => []);
			if (tiktokCdnUrls.length) {
				const beforeTimestamp = Date.now();
				const media = await WAWeb.MessageMedia.fromUrl(tiktokCdnUrls[0], {
					unsafeMime: true,
				});
				media.mimetype = 'video/mp4';
				const afterTimestamp = Date.now();
				const perfTimestamp = afterTimestamp - beforeTimestamp;

				await message.reply(media, undefined, {
					caption: `[BOT] Downloaded for ${prettyMs(perfTimestamp, {
						secondsDecimalDigits: 2,
					})}`,
				});
			}
		}

		// XBATO Feature
		if (message.body.toLowerCase().startsWith('xbato ')) {
			const args = message.body.toLowerCase().replace('xbato ', '').trim();
			const results = await searchBato(args);

			if (results.length) {
				const text = results
					.map(
						(res, index) =>
							`${index + 1}. ${res.title} [${res.languages.original} -> ${res.languages.translation}] - ${res.url}`,
					)
					.join('\n');
					await message.reply(`[BOT]\n${text}`);
			}
		}

		const batoUrl = XBATO_REGEX.exec(message.body)?.at(0);
		if (batoUrl) {
			const result = await fetchBato(batoUrl);
			if (result) {
				const text = result.chapters
					.map(
						(chapter, index) =>
							`${index + 1}. ${chapter.chapter}${chapter.name.length ? ' - '.concat(chapter.name) : ''} (${chapter.url})`,
					)
					.join('\n');
				await message.reply(`[BOT]\n${text}`);
			}
		}

		const batoChapterUrl = XBATO_CHAPTER_REGEX.exec(message.body)?.at(0);
		if (batoChapterUrl && !message.body.endsWith('--no-dl')) {
			const result = await fetchBatoImages(batoChapterUrl);
			if (result.length) {
				const pdf = await imagesToPdf(result);
				const media = WAWeb.MessageMedia.fromFilePath(pdf);
				await client.sendMessage(message.from, media);
			}
		}
	}
});

client.initialize();
