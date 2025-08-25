import WAWeb from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { rm, stat } from 'node:fs/promises';
import prettyMs from 'pretty-ms';
import { VT_TIKTOK_REGEX } from './regexes.js';
import { fetchTiktokVideo } from './services/tiktok.js';
import { findChrome } from 'find-chrome-bin';

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
	if (message.fromMe) {
        if (message.body === '--bypass' && message.hasQuotedMsg) {
            const quotedMessage = await message.getQuotedMessage();
            message.body = quotedMessage.body;
        }

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
					caption: `Downloaded for ${prettyMs(perfTimestamp, {
						secondsDecimalDigits: 2,
					})}`,
				});
			}
		}
	}
});

client.initialize();
