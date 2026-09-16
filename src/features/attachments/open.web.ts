/** Opens a stored data URL in a new tab (browsers block navigating to data: URLs directly). */
export async function openAttachment(uri: string, _mimeType: string | null, name: string) {
  const blob = await (await fetch(uri)).blob();
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (!tab) {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
