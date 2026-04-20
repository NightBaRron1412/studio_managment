// PDF generation using @react-pdf/renderer.
// Loaded via dynamic import because @react-pdf/renderer is ESM-only and the
// main process is bundled as CommonJS.
import { createElement as h } from 'react'
import { existsSync, readFileSync } from 'node:fs'
import { extname } from 'node:path'
import type { TransactionWithLines, ReportSummary, ReportFilters } from '@shared/types'

let pdfModPromise: Promise<typeof import('@react-pdf/renderer')> | null = null
async function pdfMod(): Promise<typeof import('@react-pdf/renderer')> {
  if (!pdfModPromise) pdfModPromise = import('@react-pdf/renderer')
  return pdfModPromise
}

function tryRegisterArabicFont(Font: typeof import('@react-pdf/renderer').Font): string {
  const candidates = [
    'C:/Windows/Fonts/tahoma.ttf',
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf'
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        Font.register({ family: 'AppFont', src: p })
        return 'AppFont'
      } catch {
        // ignore
      }
    }
  }
  return 'Helvetica'
}

function fmt(n: number, currency: string): string {
  const v = (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${v} ${currency}`
}

export async function exportReceiptPDF(
  outPath: string,
  tx: TransactionWithLines,
  settings: Record<string, string>
): Promise<void> {
  const { Document, Page, Text, View, StyleSheet, Font, renderToFile } = await pdfMod()
  const fontFamily = tryRegisterArabicFont(Font)

  const styles = StyleSheet.create({
    page: { padding: 32, fontFamily, fontSize: 11, direction: 'rtl' as 'rtl' },
    header: { fontSize: 18, marginBottom: 6, textAlign: 'right' },
    sub: { fontSize: 10, color: '#555', marginBottom: 16, textAlign: 'right' },
    hr: { borderBottom: '1px solid #ccc', marginVertical: 8 },
    row: { flexDirection: 'row-reverse', paddingVertical: 4, borderBottom: '1px solid #eee' },
    cell: { padding: 4 },
    cellHead: { padding: 4, fontWeight: 700, backgroundColor: '#f2f2f2' },
    totalRow: { flexDirection: 'row-reverse', marginTop: 12, paddingTop: 8, borderTop: '2px solid #333' },
    small: { fontSize: 10 }
  })

  const { Image } = await pdfMod()
  const currency = settings.currency_symbol ?? 'ج.م'
  const business = settings.business_name ?? 'نظام إدارة الاستوديو'
  const phone = settings.phone ?? ''
  const address = settings.address ?? ''

  // Load the logo as a Buffer. Passing a raw file path to @react-pdf/renderer
  // is unreliable across OSes (especially Windows backslashes); a Buffer always
  // works. If anything fails, we skip the logo entirely instead of leaving
  // a blank rectangle on the page.
  let logoSrc: { data: Buffer; format: 'png' | 'jpg' } | null = null
  try {
    if (settings.logo_path && existsSync(settings.logo_path)) {
      const ext = extname(settings.logo_path).toLowerCase()
      const fmt: 'png' | 'jpg' | null =
        ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpg' : null
      if (fmt) {
        logoSrc = { data: readFileSync(settings.logo_path), format: fmt }
      }
    }
  } catch (e) {
    console.warn('logo load failed:', e instanceof Error ? e.message : e)
    logoSrc = null
  }

  const headerCells = [
    h(View, { key: 'h1', style: { ...styles.cellHead, flex: 3, textAlign: 'right' } }, h(Text, null, 'الصنف')),
    h(View, { key: 'h2', style: { ...styles.cellHead, flex: 1, textAlign: 'center' } }, h(Text, null, 'الكمية')),
    h(View, { key: 'h3', style: { ...styles.cellHead, flex: 1, textAlign: 'left' } }, h(Text, null, 'السعر')),
    h(View, { key: 'h4', style: { ...styles.cellHead, flex: 1, textAlign: 'left' } }, h(Text, null, 'الإجمالي'))
  ]

  const lineRows = tx.lines.map((l, i) =>
    h(View, { key: `l-${i}`, style: styles.row }, [
      h(View, { key: 'a', style: { ...styles.cell, flex: 3, textAlign: 'right' } }, h(Text, null, l.item_name || l.custom_name || 'صنف')),
      h(View, { key: 'b', style: { ...styles.cell, flex: 1, textAlign: 'center' } }, h(Text, null, String(l.quantity))),
      h(View, { key: 'c', style: { ...styles.cell, flex: 1, textAlign: 'left' } }, h(Text, null, fmt(l.unit_price, currency))),
      h(View, { key: 'd', style: { ...styles.cell, flex: 1, textAlign: 'left' } }, h(Text, null, fmt(l.subtotal, currency)))
    ])
  )

  const doc = h(Document, null,
    h(Page, { size: 'A5', style: styles.page }, [
      logoSrc
        ? h(
            View,
            { key: 'logo', style: { alignItems: 'center', marginBottom: 6 } },
            h(Image, {
              src: logoSrc as never,
              style: { width: 72, height: 72, objectFit: 'contain' as never }
            })
          )
        : null,
      h(Text, { key: 'h', style: styles.header }, business),
      h(Text, { key: 's', style: styles.sub }, `${address ? address + ' • ' : ''}${phone}`),
      h(Text, { key: 'tn', style: { textAlign: 'right', marginBottom: 4 } }, `رقم الفاتورة: ${tx.transaction_no}`),
      h(Text, { key: 'd', style: { textAlign: 'right', marginBottom: 4 } }, `التاريخ: ${tx.date}`),
      tx.client_name ? h(Text, { key: 'c', style: { textAlign: 'right', marginBottom: 4 } }, `العميل: ${tx.client_name}`) : null,
      tx.staff_name ? h(Text, { key: 'st', style: { textAlign: 'right', marginBottom: 4 } }, `الموظف: ${tx.staff_name}`) : null,
      h(View, { key: 'hr', style: styles.hr }),
      h(View, { key: 'th', style: styles.row }, headerCells),
      ...lineRows,
      h(View, { key: 'sub', style: { flexDirection: 'row-reverse', marginTop: 12, paddingTop: 6, borderTop: '1px solid #ccc' } }, [
        h(View, { key: 'a', style: { flex: 5, textAlign: 'right' } }, h(Text, null, 'المجموع الفرعي')),
        h(View, { key: 'b', style: { flex: 1, textAlign: 'left' } }, h(Text, null, fmt(tx.subtotal, currency)))
      ]),
      tx.discount_amount > 0
        ? h(View, { key: 'disc', style: { flexDirection: 'row-reverse', paddingVertical: 2 } }, [
            h(
              View,
              { key: 'a', style: { flex: 5, textAlign: 'right' } },
              h(
                Text,
                null,
                tx.discount_type === 'percent'
                  ? `الخصم (${tx.discount_value}%)`
                  : 'الخصم'
              )
            ),
            h(View, { key: 'b', style: { flex: 1, textAlign: 'left' } }, h(Text, null, `- ${fmt(tx.discount_amount, currency)}`))
          ])
        : null,
      tx.vat_amount > 0
        ? h(View, { key: 'vat', style: { flexDirection: 'row-reverse', paddingVertical: 2 } }, [
            h(View, { key: 'a', style: { flex: 5, textAlign: 'right' } }, h(Text, null, `ضريبة القيمة المضافة (${tx.vat_percent}%)`)),
            h(View, { key: 'b', style: { flex: 1, textAlign: 'left' } }, h(Text, null, fmt(tx.vat_amount, currency)))
          ])
        : null,
      h(View, { key: 'tot', style: styles.totalRow }, [
        h(View, { key: 'tla', style: { flex: 5, textAlign: 'right', fontWeight: 700 } }, h(Text, null, 'الإجمالي')),
        h(View, { key: 'tlb', style: { flex: 1, textAlign: 'left', fontWeight: 700 } }, h(Text, null, fmt(tx.total, currency)))
      ]),
      h(View, { key: 'paid', style: { flexDirection: 'row-reverse', paddingVertical: 2, marginTop: 4 } }, [
        h(View, { key: 'a', style: { flex: 5, textAlign: 'right' } }, h(Text, null, 'المدفوع')),
        h(View, { key: 'b', style: { flex: 1, textAlign: 'left' } }, h(Text, null, fmt(tx.paid_amount, currency)))
      ]),
      tx.total - tx.paid_amount > 0.001
        ? h(View, { key: 'rem', style: { flexDirection: 'row-reverse', paddingVertical: 2 } }, [
            h(View, { key: 'a', style: { flex: 5, textAlign: 'right', color: '#b91c1c' } }, h(Text, null, 'المتبقي (آجل)')),
            h(View, { key: 'b', style: { flex: 1, textAlign: 'left', color: '#b91c1c' } }, h(Text, null, fmt(tx.total - tx.paid_amount, currency)))
          ])
        : null,
      tx.notes ? h(Text, { key: 'no', style: { ...styles.small, marginTop: 12 } }, `ملاحظات: ${tx.notes}`) : null,
      h(Text, { key: 'th2', style: { ...styles.small, marginTop: 18, textAlign: 'center' } }, 'شكراً لتعاملكم معنا'),
      h(Text, { key: 'cr', style: { fontSize: 8, color: '#999', marginTop: 8, textAlign: 'center' } }, 'برنامج إدارة الاستوديو — تطوير: أمير شتية')
    ])
  )

  await renderToFile(doc as Parameters<typeof renderToFile>[0], outPath)
}

export async function exportReportPDF(
  outPath: string,
  summary: ReportSummary,
  filters: ReportFilters,
  settings: Record<string, string>
): Promise<void> {
  const { Document, Page, Text, View, StyleSheet, Font, renderToFile } = await pdfMod()
  const fontFamily = tryRegisterArabicFont(Font)

  const styles = StyleSheet.create({
    page: { padding: 32, fontFamily, fontSize: 11, direction: 'rtl' as 'rtl' },
    header: { fontSize: 16, marginBottom: 6, textAlign: 'right' },
    sub: { fontSize: 10, color: '#555', marginBottom: 16, textAlign: 'right' },
    row: { flexDirection: 'row-reverse', paddingVertical: 4, borderBottom: '1px solid #eee' },
    cell: { padding: 4 },
    cellHead: { padding: 4, fontWeight: 700, backgroundColor: '#f2f2f2' }
  })

  const currency = settings.currency_symbol ?? 'ج.م'
  const business = settings.business_name ?? 'نظام إدارة الاستوديو'
  const dateRange = `${filters.date_from || '—'} إلى ${filters.date_to || '—'}`

  const itemRows = summary.by_item.map((it, i) =>
    h(View, { key: `it-${i}`, style: styles.row }, [
      h(View, { key: 'a', style: { ...styles.cell, flex: 3, textAlign: 'right' } }, h(Text, null, it.name || '')),
      h(View, { key: 'b', style: { ...styles.cell, flex: 1, textAlign: 'center' } }, h(Text, null, String(it.quantity || 0))),
      h(View, { key: 'c', style: { ...styles.cell, flex: 1, textAlign: 'left' } }, h(Text, null, fmt(it.revenue || 0, currency)))
    ])
  )

  const dayRows = summary.by_day.map((d, i) =>
    h(View, { key: `d-${i}`, style: styles.row }, [
      h(View, { key: 'a', style: { ...styles.cell, flex: 3, textAlign: 'right' } }, h(Text, null, d.date)),
      h(View, { key: 'b', style: { ...styles.cell, flex: 1, textAlign: 'center' } }, h(Text, null, String(d.tx_count))),
      h(View, { key: 'c', style: { ...styles.cell, flex: 1, textAlign: 'left' } }, h(Text, null, fmt(d.income, currency)))
    ])
  )

  const doc = h(Document, null,
    h(Page, { size: 'A4', style: styles.page }, [
      h(Text, { key: 'h', style: styles.header }, `${business} — تقرير`),
      h(Text, { key: 's', style: styles.sub }, `الفترة: ${dateRange}`),
      h(View, { key: 'sm', style: { marginBottom: 14 } }, [
        h(Text, { key: '1' }, `إجمالي الإيرادات: ${fmt(summary.income_total, currency)}`),
        h(Text, { key: '2' }, `عدد المعاملات: ${summary.tx_count}`),
        h(Text, { key: '3' }, `السحوبات النقدية: ${fmt(summary.withdrawals_total, currency)}`),
        h(Text, { key: '4' }, `الإيجار المدفوع: ${fmt(summary.rent_total, currency)}`),
        h(Text, { key: '5' }, `المشتريات: ${fmt(summary.inventory_total, currency)}`),
        h(Text, { key: '6', style: { marginTop: 6, fontWeight: 700 } }, `الصافي: ${fmt(summary.net_total, currency)}`)
      ]),
      h(Text, { key: 'h2', style: styles.header }, 'المبيعات حسب الصنف'),
      h(View, { key: 'th', style: styles.row }, [
        h(View, { key: 'h1', style: { ...styles.cellHead, flex: 3, textAlign: 'right' } }, h(Text, null, 'الصنف')),
        h(View, { key: 'h2', style: { ...styles.cellHead, flex: 1, textAlign: 'center' } }, h(Text, null, 'الكمية')),
        h(View, { key: 'h3', style: { ...styles.cellHead, flex: 1, textAlign: 'left' } }, h(Text, null, 'الإيراد'))
      ]),
      ...itemRows,
      h(Text, { key: 'h3', style: { ...styles.header, marginTop: 16 } }, 'المبيعات حسب اليوم'),
      h(View, { key: 'th2', style: styles.row }, [
        h(View, { key: 'h1', style: { ...styles.cellHead, flex: 3, textAlign: 'right' } }, h(Text, null, 'التاريخ')),
        h(View, { key: 'h2', style: { ...styles.cellHead, flex: 1, textAlign: 'center' } }, h(Text, null, 'عدد المعاملات')),
        h(View, { key: 'h3', style: { ...styles.cellHead, flex: 1, textAlign: 'left' } }, h(Text, null, 'الإيراد'))
      ]),
      ...dayRows
    ])
  )

  await renderToFile(doc as Parameters<typeof renderToFile>[0], outPath)
}
