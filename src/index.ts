import { Browsers, DisconnectReason, makeWASocket, useMultiFileAuthState } from 'baileys';
import { readFile, rm } from 'node:fs/promises';
import qrcode from 'qrcode';
import type { Boom } from '@hapi/boom';
import {
	NORMALIZED_ID_REGEX,
	VT_TIKTOK_REGEX,
	XBATO_CHAPTER_REGEX,
	XBATO_REGEX,
} from './regexes.js';
import { fetchTiktokVideo, getTikTokURL } from './services/tiktok.js';
import got from 'got';
import prettyMilliseconds from 'pretty-ms';
import { fetchBato, fetchBatoImages, searchBato } from './services/xbato.js';
import { imagesToPdf } from './services/pdfs.js';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';

const rmPreviousQr = async () => {
	await rm('qr.png').catch(() => undefined);
};

async function runWaBot() {
	await rmPreviousQr();

	const auth = await useMultiFileAuthState('wa_session');
	const socket = makeWASocket({
		auth: auth.state,
		browser: Browsers.macOS('Chrome'),
		syncFullHistory: true,
	});

	socket.ev.on('connection.update', (conn) => {
		if (conn.qr) {
			qrcode.toFile('qr.png', conn.qr, (err) => {
				if (err) {
					throw err;
				}
			});

			qrcode.toString(conn.qr, (err, qr) => {
				if (err) {
					throw err;
				}

				console.log(qr);
			});
		}

		if (conn.connection === 'close') {
			const shouldReconnect =
				(conn.lastDisconnect?.error as Boom)?.output.statusCode !==
				DisconnectReason.loggedOut;
			if (shouldReconnect) {
				return runWaBot();
			}
		} else if (conn.connection === 'open') {
			console.log(`Logged in as: ${socket.user?.id}`);
		}

		return;
	});

	socket.ev.on('creds.update', auth.saveCreds);

	socket.ev.on('messages.upsert', async ({ messages }) => {
		const msg = messages.at(0);

		if (['newsletter', 'status'].includes(msg?.key.remoteJid as string)) {
			return;
		}

		const quotedMsg = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
		let text =
			msg?.message?.conversation?.trim() ?? msg?.message?.extendedTextMessage?.text?.trim();
		const isBypass = quotedMsg && text === '--bypass';
		const fromMe = msg?.key.participant
			? msg.key.participant.replace(NORMALIZED_ID_REGEX, '') ===
				socket.user?.lid?.replace(NORMALIZED_ID_REGEX, '')
			: msg?.key.remoteJid?.replace(NORMALIZED_ID_REGEX, '') ===
				socket.user?.id.replace(NORMALIZED_ID_REGEX, '');

		if (msg && (fromMe || msg.key.fromMe) && !text?.startsWith('[BOT]')) {
			if (isBypass) {
				text = quotedMsg.conversation ?? '';
			}

			if (!text?.length) {
				return;
			}

			// Tiktok feature
			const tiktokUrl = getTikTokURL(text);
			if (tiktokUrl) {
				const tiktokCdnUrls = await fetchTiktokVideo(tiktokUrl);
				if (tiktokCdnUrls.length) {
					const beforeTs = Date.now();
					const response = await got(tiktokCdnUrls[0]).buffer();
					await socket.sendMessage(
						msg.key.remoteJid as string,
						{
							video: response,
							mimetype: 'video/mp4',
							caption: `Downloaded for ${prettyMilliseconds(Date.now() - beforeTs)}`,
						},
						{
							quoted: msg,
						},
					);
					return;
				}
			}

			if (text.toLowerCase().startsWith('xbato ')) {
				const args = text.toLowerCase().replace('xbato ', '').trim();
				const results = await searchBato(args);

				if (results.length) {
					const text = results
						.map(
							(res, index) =>
								`${index + 1}. ${res.title} [${res.languages.original} -> ${res.languages.translation}] - ${res.url}`,
						)
						.join('\n');

					if (isBypass) {
						await socket.sendMessage(msg.key.remoteJid as string, {
							text: `[BOT]\n${text}`,
						});
					} else {
						await socket.sendMessage(msg.key.remoteJid as string, {
							edit: msg.key,
							text: `[BOT]\n${text}`,
						});
					}
					return;
				}
			}

			const batoUrl = XBATO_REGEX.exec(text)?.at(0);
			if (batoUrl) {
				const result = await fetchBato(batoUrl);
				if (result) {
					const text = result.chapters
						.map(
							(chapter, index) =>
								`${index + 1}. ${chapter.chapter}${chapter.name.length ? ' - '.concat(chapter.name) : ''} (${chapter.url})`,
						)
						.join('\n');

					await socket.sendMessage(
						msg.key.remoteJid as string,
						{
							text: `[BOT]\n${text}`,
						},
						{
							quoted: msg,
						},
					);
					return;
				}
			}

			const batoChapterUrl = XBATO_CHAPTER_REGEX.exec(text)?.at(0);
			if (batoChapterUrl && !text.endsWith('--no-dl')) {
				const result = await fetchBatoImages(batoChapterUrl);
				if (result.length) {
					const pdf = await imagesToPdf(result);
					await socket.sendMessage(
						msg.key.remoteJid as string,
						{
							document: {
								stream: createReadStream(pdf),
							},
							mimetype: 'application/pdf',
							fileName: basename(pdf),
						},
						{
							quoted: msg,
						},
					);
				}
				return;
			}
		}
	});
}

runWaBot();
