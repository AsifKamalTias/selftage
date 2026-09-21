/** Triggers a browser download of a text file. */
export async function shareTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([`﻿${content}`], { type: `${mimeType};charset=utf-8` });
  download(URL.createObjectURL(blob), fileName);
}

function download(url: string, fileName: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Opens the browser print dialog for the report, where it can be saved as a PDF.
 * The frame is kept alive until printing finishes — removing it while the dialog is
 * open cancels the job in browsers where `print()` returns immediately.
 */
export async function sharePdf(fileName: string, html: string) {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  frame.setAttribute('aria-hidden', 'true');
  frame.title = fileName;

  const cleanup = () => {
    if (frame.parentNode) frame.remove();
  };

  try {
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error('Printing is blocked in this browser.');

    doc.open();
    doc.write(html);
    doc.close();

    // Wait for the document (and its fonts) to settle before printing.
    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') {
        resolve();
        return;
      }
      const done = () => resolve();
      win.addEventListener('load', done, { once: true });
      setTimeout(done, 1_500);
    });

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      win.addEventListener('afterprint', finish, { once: true });
      // Some browsers never fire afterprint; hold the frame long enough either way.
      setTimeout(finish, 60_000);
      win.focus();
      win.print();
    });
  } catch (error) {
    cleanup();
    // Falling back to a download beats leaving the person with nothing.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    download(URL.createObjectURL(blob), fileName.replace(/\.pdf$/i, '.html'));
    throw new Error(
      `${
        error instanceof Error ? error.message : 'Printing failed'
      } — the report was downloaded as HTML instead; open it and print to PDF.`
    );
  }
  cleanup();
}
