/**
 * Xuất PDF diễn giải chuyến đi — bản web.
 *
 * App native: HTML → expo-print → share sheet. Web: dựng cùng HTML (util thuần
 * `exportHtml`) vào iframe ẩn rồi gọi `print()` → người dùng chọn "Lưu dưới dạng
 * PDF" (hoặc in). Không cần thư viện PDF, chữ tiếng Việt hiển thị đúng font hệ thống.
 */
import { buildTripGroupHtml, buildTripPersonHtml, type TripExportData } from '../utils/exportHtml';

export type ExportScope = { type: 'group' } | { type: 'person'; memberId: string };

/** Tên file gợi ý (Chrome dùng <title> làm tên PDF mặc định). */
export function buildFileName(data: TripExportData, scope: ExportScope): string {
  const tripPart = data.tripName.replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'Trip';
  if (scope.type === 'group') return `FairPay - ${tripPart} - ca nhom`;
  const member = data.members.find((m) => m.id === scope.memberId);
  const namePart = (member?.displayName ?? 'thanh-vien').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 40);
  return `FairPay - ${tripPart} - ${namePart}`;
}

export function buildTripHtml(data: TripExportData, scope: ExportScope): string {
  const html = scope.type === 'group' ? buildTripGroupHtml(data) : buildTripPersonHtml(data, scope.memberId);
  // Đặt <title> = tên file để hộp thoại "Lưu PDF" gợi ý đúng tên.
  const title = buildFileName(data, scope).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

/** In/Lưu PDF qua iframe ẩn (không bị popup blocker chặn). */
export function printTripPdf(data: TripExportData, scope: ExportScope): Promise<void> {
  const html = buildTripHtml(data, scope);
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 1000);
    };

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
      iframe.remove();
      reject(new Error('Trình duyệt không hỗ trợ in'));
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();

    // Đợi layout/font xong rồi mới mở hộp thoại in.
    const fire = () => {
      try {
        win.focus();
        win.print();
        resolve();
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Không mở được hộp thoại in'));
      } finally {
        cleanup();
      }
    };
    if (doc.readyState === 'complete') setTimeout(fire, 250);
    else win.addEventListener('load', () => setTimeout(fire, 250), { once: true });
  });
}

/** Tải file HTML (dự phòng khi trình duyệt chặn in, vd in-app browser của Zalo). */
export function downloadTripHtml(data: TripExportData, scope: ExportScope): void {
  const html = buildTripHtml(data, scope);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${buildFileName(data, scope)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
