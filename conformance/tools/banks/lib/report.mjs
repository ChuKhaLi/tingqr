// Markdown report for a run of update.mjs (PR body, issue body, or console).

/**
 * @param {{
 *   today: string,
 *   banks: { added: string[], removed: string[], changed: string[], refused: boolean },
 *   apps: { appId: string, kind: string, detail: string }[],
 *   play: { gone: string[], unknown: string[], checked: number },
 *   logos?: string[],
 * }} r
 */
export function renderReport(r) {
  const lines = [`# Kiểm danh sách ngân hàng ${r.today}`, '']
  lines.push('## Ngân hàng (api.vietqr.io/v2/banks)', '')
  if (r.banks.refused) {
    lines.push(`- **Từ chối ghi:** API bỏ ${r.banks.removed.length} ngân hàng một lần (giới hạn 5). Kiểm tay trước khi tin.`)
  }
  const list = (label, items) => items.length && lines.push(`- ${label}: ${items.join(', ')}`)
  list('Thêm', r.banks.added)
  list('Bỏ', r.banks.removed)
  list('Đổi', r.banks.changed)
  if (!r.banks.added.length && !r.banks.removed.length && !r.banks.changed.length) lines.push('- Không đổi.')
  lines.push('', '## App (dl.vietqr.io)', '')
  if (r.apps.length === 0) lines.push('- Không đổi.')
  for (const d of r.apps) lines.push(`- \`${d.appId}\` ${d.kind}: ${d.detail}`)
  lines.push('', `## Google Play (${r.play.checked} gói)`, '')
  list('Gói không còn (404)', r.play.gone)
  if (r.play.unknown.length) lines.push(`- ${r.play.unknown.length} gói chưa kiểm được: ${r.play.unknown.join(', ')}`)
  if (!r.play.gone.length && !r.play.unknown.length) lines.push('- Mọi gói còn trên Google Play.')
  if (r.logos) {
    lines.push('', '## Ảnh', '')
    if (r.logos.length === 0) lines.push('- Không đổi.')
    for (const l of r.logos) lines.push(`- ${l}`)
  }
  return lines.join('\n') + '\n'
}
