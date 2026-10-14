// =====================================================
// พิมพ์ใบเสร็จ / สรุปกะ ผ่านหน้าต่างใหม่ (กระดาษความร้อน 80 มม.)
// ใช้ได้กับเครื่องพิมพ์ที่ติดตั้งในเครื่อง (เลือกเครื่องพิมพ์ในหน้าต่างพิมพ์ของเบราว์เซอร์)
// =====================================================

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function printHtml(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=420,height=700')

  if (!win) {
    window.alert(
      'เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up สำหรับเว็บนี้'
    )

    return
  }

  win.document.write(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; font-family: Tahoma, 'Noto Sans Thai', sans-serif; font-size: 13px; color: #000; }
  h2 { margin: 0; text-align: center; font-size: 18px; }
  .c { text-align: center; }
  .row { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .b { font-weight: bold; }
  .sm { font-size: 11px; color: #333; }
</style>
</head>
<body>
${bodyHtml}
<script>
  window.onload = function () {
    window.focus();
    window.print();
  };
</script>
</body>
</html>`)

  win.document.close()
}
