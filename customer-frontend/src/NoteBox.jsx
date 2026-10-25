// ช่องหมายเหตุรายเมนู (เช่น ต้องการเป็ด/ไก่ฉ่ำ ๆ หรือแห้ง ๆ)
const QUICK = ['ฉ่ำ ๆ', 'แห้ง ๆ']

export default function NoteBox({ value, onChange, category, compact }) {
  const quick = category === 'duck' || category === 'chicken'
  const text = String(value || '')

  return (
    <div className={`note-box ${compact ? 'compact' : ''}`}>
      {quick && (
        <div className="note-chips">
          {QUICK.map(q => (
            <button
              type="button"
              key={q}
              className={text.includes(q) ? 'on' : ''}
              onClick={() => onChange(text.includes(q) ? text.replace(q, '').replace(/\s+/g, ' ').trim() : `${text} ${q}`.trim())}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <input
        type="text"
        placeholder={quick ? 'หมายเหตุ เช่น ฉ่ำ ๆ แห้ง ๆ ไม่เผ็ด (ไม่บังคับ)' : 'หมายเหตุ (ไม่บังคับ)'}
        value={text}
        maxLength={200}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
