import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface LicenseCertificateData {
  licenseNumber: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string | null;
  buyerCompany: string | null;
  assetPublicId: string;
  assetTitle: string | null;
  productName: string;
  licenseTypeName: string;
  licenseTypeDescription: string | null;
  /** 'web' | 'hd' ... as sold */
  resolution: string;
  deliveredFile: string;
  issuedAt: Date;
  termsVersion: string;
  rights: string[];
  restrictions: string[];
  territory: string | null;
  durationMonths: number | null;
  maxUsers: number | null;
  licensor: string;
}

/** SVL-<year>-<12 hex>: derived from the purchased licence id, hence unique and stable across regenerations. */
export function licenseNumberFor(licenseId: string, issuedAt: Date): string {
  return `SVL-${issuedAt.getUTCFullYear()}-${licenseId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function humanizeCode(code: string): string {
  const text = code.replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function resolutionLabel(resolution: string): string {
  const value = resolution.trim().toLowerCase();
  if (value === 'web') return 'Web (JPEG, long side up to 1920 px, no watermark)';
  if (value === 'hd') return 'HD (full-resolution original file, no watermark)';
  if (value === 'ultrahd') return 'Ultra HD (full-resolution original file)';
  return humanizeCode(resolution);
}

// The standard PDF fonts only encode WinAnsi: anything else (e.g. non-Latin names) is replaced rather than crashing the document.
function safe(font: PDFFont, text: string): string {
  let out = '';
  for (const char of text.replace(/[\r\n\t]+/g, ' ')) {
    try { font.encodeText(char); out += char; } catch { out += '?'; }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of safe(font, text).split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Renders the A4 licence certificate. Pure: no I/O. */
export async function buildLicensePdf(data: LicenseCertificateData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Licence ${data.licenseNumber}`);
  pdf.setAuthor(data.licensor);
  pdf.setSubject(`Image licence for ${data.assetPublicId}`);
  pdf.setCreationDate(data.issuedAt);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
  const ink = rgb(0.09, 0.13, 0.2), muted = rgb(0.4, 0.45, 0.52), accent = rgb(0.05, 0.4, 0.55);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const ensure = (space: number) => {
    if (y - space < M + 30) { page = pdf.addPage([W, H]); y = H - M; }
  };
  const text = (value: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10, font = opts.font ?? regular;
    for (const line of wrap(font, value, size, opts.width ?? CW)) {
      ensure(size + 4);
      page.drawText(line, { x: opts.x ?? M, y: y - size, size, font, color: opts.color ?? ink });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };
  const rule = () => { ensure(10); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.8, 0.83, 0.87) }); y -= 12; };
  const field = (label: string, value: string) => {
    ensure(26);
    page.drawText(safe(regular, label.toUpperCase()), { x: M, y: y - 8, size: 7.5, font: bold, color: muted });
    y -= 12;
    const lines = wrap(regular, value || '-', 11, CW - 4);
    for (const line of lines) { ensure(15); page.drawText(line, { x: M, y: y - 11, size: 11, font: regular, color: ink }); y -= 15; }
    y -= 4;
  };

  // Header band
  page.drawRectangle({ x: 0, y: H - 92, width: W, height: 92, color: accent });
  page.drawText(safe(bold, data.licensor), { x: M, y: H - 46, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText('IMAGE LICENCE CERTIFICATE', { x: M, y: H - 68, size: 11, font: regular, color: rgb(0.88, 0.95, 0.97) });
  y = H - 92 - 28;

  text(`Licence No. ${data.licenseNumber}`, { size: 16, font: bold, gap: 4 });
  text(`Issued on ${data.issuedAt.toISOString().slice(0, 10)} (UTC)`, { size: 9.5, color: muted, gap: 8 });
  rule();

  field('Licensee (buyer)', [data.buyerName, data.buyerCompany].filter(Boolean).join(' - ') + (data.buyerEmail ? ` <${data.buyerEmail}>` : ''));
  field('Order number', data.orderNumber);
  field('Licensed photo', `${data.assetPublicId}${data.assetTitle ? ` - ${data.assetTitle}` : ''}`);
  field('Product', data.productName);
  field('Licence type', data.licenseTypeName);
  field('Resolution delivered', `${resolutionLabel(data.resolution)} - ${data.deliveredFile}`);
  field('Licensor', data.licensor);
  rule();

  text('LICENCE TERMS', { size: 9, font: bold, color: muted, gap: 4 });
  if (data.licenseTypeDescription) text(data.licenseTypeDescription, { size: 10.5, gap: 6 });
  const terms: string[] = [
    `Territory: ${data.territory ? humanizeCode(data.territory) : 'Worldwide'}`,
    `Duration: ${data.durationMonths ? `${data.durationMonths} months` : 'Perpetual'}`,
    `Maximum users: ${data.maxUsers ?? 'Not limited'}`,
    `Terms version: ${data.termsVersion}`,
  ];
  for (const line of terms) text(`-  ${line}`, { size: 10.5 });
  y -= 6;

  text('Rights granted', { size: 11, font: bold, gap: 2 });
  if (data.rights.length) for (const right of data.rights) text(`-  ${humanizeCode(right)}`, { size: 10.5, x: M + 8, width: CW - 8 });
  else text('As described in the licence type above.', { size: 10.5 });
  y -= 6;

  text('Restrictions', { size: 11, font: bold, gap: 2 });
  if (data.restrictions.length) for (const restriction of data.restrictions) text(`-  ${humanizeCode(restriction)}`, { size: 10.5, x: M + 8, width: CW - 8 });
  else text('None specified.', { size: 10.5 });
  y -= 10;

  rule();
  text(
    `This certificate documents the licence granted by ${data.licensor} to the licensee named above for the photo identified above. ` +
      'Keep it together with the proof of purchase (order number above).',
    { size: 9, color: muted }
  );

  // Footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText(safe(regular, `${data.licenseNumber}  |  ${data.licensor}  |  page ${index + 1}/${pages.length}`), { x: M, y: 28, size: 8, font: regular, color: muted });
  });

  return pdf.save();
}
