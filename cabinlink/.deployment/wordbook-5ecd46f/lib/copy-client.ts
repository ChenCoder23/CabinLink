export async function copyText(value: string) {
  try { await navigator.clipboard.writeText(value); return; } catch { /* HTTP pages do not expose Clipboard API. */ }
  const input = document.createElement("textarea"); input.value = value; input.setAttribute("readonly", ""); input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select();
  const copied = document.execCommand("copy"); input.remove(); if (!copied) throw new Error("浏览器未允许复制，请手动长按或选择链接复制。");
}
