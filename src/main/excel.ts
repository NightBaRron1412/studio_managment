import ExcelJS from 'exceljs'
import type { ClientWithStats, ReportFilters, ReportSummary } from '@shared/types'

export async function exportReportExcel(
  outPath: string,
  summary: ReportSummary,
  filters: ReportFilters,
  settings: Record<string, string>
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = settings.business_name ?? 'نظام إدارة الاستوديو'
  wb.created = new Date()

  const summarySheet = wb.addWorksheet('الملخص', { views: [{ rightToLeft: true }] })
  summarySheet.columns = [
    { header: 'البند', key: 'k', width: 30 },
    { header: 'القيمة', key: 'v', width: 18 }
  ]
  summarySheet.addRow({ k: 'الفترة', v: `${filters.date_from || '—'} → ${filters.date_to || '—'}` })
  summarySheet.addRow({ k: 'إجمالي الإيرادات', v: summary.income_total })
  summarySheet.addRow({ k: 'عدد المعاملات', v: summary.tx_count })
  summarySheet.addRow({ k: 'السحوبات النقدية', v: summary.withdrawals_total })
  summarySheet.addRow({ k: 'الإيجار المدفوع', v: summary.rent_total })
  summarySheet.addRow({ k: 'المشتريات', v: summary.inventory_total })
  summarySheet.addRow({ k: 'الصافي', v: summary.net_total })
  summarySheet.getRow(1).font = { bold: true }

  const itemsSheet = wb.addWorksheet('حسب الصنف', { views: [{ rightToLeft: true }] })
  itemsSheet.columns = [
    { header: 'الصنف', key: 'name', width: 40 },
    { header: 'الكمية', key: 'qty', width: 12 },
    { header: 'الإيراد', key: 'rev', width: 18 }
  ]
  summary.by_item.forEach((it) => itemsSheet.addRow({ name: it.name, qty: it.quantity, rev: it.revenue }))
  itemsSheet.getRow(1).font = { bold: true }

  const daySheet = wb.addWorksheet('حسب اليوم', { views: [{ rightToLeft: true }] })
  daySheet.columns = [
    { header: 'التاريخ', key: 'date', width: 14 },
    { header: 'عدد المعاملات', key: 'c', width: 16 },
    { header: 'الإيراد', key: 'r', width: 18 }
  ]
  summary.by_day.forEach((d) => daySheet.addRow({ date: d.date, c: d.tx_count, r: d.income }))
  daySheet.getRow(1).font = { bold: true }

  const catSheet = wb.addWorksheet('حسب التصنيف', { views: [{ rightToLeft: true }] })
  catSheet.columns = [
    { header: 'التصنيف', key: 'name', width: 32 },
    { header: 'الإيراد', key: 'rev', width: 18 }
  ]
  summary.by_category.forEach((c) => catSheet.addRow({ name: c.name, rev: c.revenue }))
  catSheet.getRow(1).font = { bold: true }

  await wb.xlsx.writeFile(outPath)
}

export async function exportClientsExcel(
  outPath: string,
  clients: ClientWithStats[],
  settings: Record<string, string>
): Promise<void> {
  const wb = new ExcelJS.Workbook()
  wb.creator = settings.business_name ?? 'نظام إدارة الاستوديو'
  wb.created = new Date()
  const sheet = wb.addWorksheet('العملاء', { views: [{ rightToLeft: true }] })
  sheet.columns = [
    { header: 'الاسم', key: 'name', width: 32 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'العنوان', key: 'address', width: 36 },
    { header: 'الزيارات', key: 'visits', width: 12 },
    { header: 'إجمالي المشتريات', key: 'spent', width: 18 },
    { header: 'مستحقات', key: 'out', width: 14 },
    { header: 'آخر زيارة', key: 'last', width: 14 },
    { header: 'ملاحظات', key: 'notes', width: 32 },
    { header: 'تاريخ التسجيل', key: 'created', width: 16 }
  ]
  for (const c of clients) {
    sheet.addRow({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      visits: c.visit_count,
      spent: c.total_spent,
      out: c.outstanding ?? 0,
      last: c.last_visit || '',
      notes: c.notes || '',
      created: (c.created_at || '').slice(0, 10)
    })
  }
  sheet.getRow(1).font = { bold: true }
  await wb.xlsx.writeFile(outPath)
}
