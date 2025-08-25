import got from 'got';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { Sha256 } from '@aws-crypto/sha256-js';
import { stat, writeFile } from 'node:fs/promises';

export const imagesToPdf = async (urls: string[]) => {
	const hash = new Sha256();
	hash.update(JSON.stringify(urls));
	const hashOfUrls = await hash.digest();

	const fileHash = await stat(`./files/${Buffer.from(hashOfUrls).toString('hex')}.pdf`).catch(
		() => undefined,
	);
	if (fileHash) {
		return `./files/${Buffer.from(hashOfUrls).toString('hex')}.pdf`;
	}

	console.log(`[imagesToPdf]: Downloading ${Buffer.from(hashOfUrls).toString('hex')} chapter`);

	const pdfDoc = await PDFDocument.create();
	for (const url of urls) {
		console.log(`[imagesToPdf]: Downloading image from ${url}`);

		let imageBuffer = await got(url, {
			timeout: {
				connect: 15_000,
				read: 30_000,
				request: 30_000,
				response: 30_000,
				send: 30_000,
				socket: 30_000,
				secureConnect: 30_000,
				lookup: 30_000,
			},
		}).buffer();
		imageBuffer = await sharp(imageBuffer).png().toBuffer();

		console.log(`[imagesToPdf]: Adding image from ${url} to PDF`);

		const image = await pdfDoc.embedPng(imageBuffer);
		const { width, height } = image.scale(1);

		const page = pdfDoc.addPage([width, height]);
		page.drawImage(image, {
			x: 0,
			y: 0,
			width,
			height,
		});
	}

	pdfDoc.setTitle(`Chapter ${Buffer.from(hashOfUrls).toString('hex')}`);
	pdfDoc.setAuthor('xbato.com');
	pdfDoc.setCreationDate(new Date());
	pdfDoc.setModificationDate(new Date());

	const file = await pdfDoc.save();
	await writeFile(`./files/${Buffer.from(hashOfUrls).toString('hex')}.pdf`, file);

	return `./files/${Buffer.from(hashOfUrls).toString('hex')}.pdf`;
};
