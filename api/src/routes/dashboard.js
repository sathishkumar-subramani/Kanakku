import { Router } from 'express'
import { query, schemas } from '../lib/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { reportToPdf } from '../services/pdf.js'
import { buildDashboard, buildReport, reportMonths, reportToCsv } from '../services/reports.js'

export const dashboardRouter = Router()
dashboardRouter.use(requireAuth)

dashboardRouter.get('/', query(schemas.monthQuery), async (req, res) => {
  res.json(await buildDashboard(req.userId, req.q.month))
})

export const reportsRouter = Router()
reportsRouter.use(requireAuth)

reportsRouter.get('/months', async (req, res) => {
  res.json(await reportMonths(req.userId))
})

reportsRouter.get('/monthly', query(schemas.reportQuery), async (req, res) => {
  const report = await buildReport(req.userId, req.q.month, req.q.groupId)
  const suffix = report.scopeSlug ? `-${report.scopeSlug}` : ''
  if (req.q.format === 'csv') {
    res
      .status(200)
      .set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="kanakku-${report.month}${suffix}.csv"` })
      .send(reportToCsv(report))
    return
  }
  const pdf = await reportToPdf(report)
  res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="kanakku-${report.month}${suffix}.pdf"`, 'Content-Length': String(pdf.length) }).send(pdf)
})
