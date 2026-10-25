const express = require('express')
const prisma = require('../db')
const { cutStock, lockBranch, supportsHalf, confirmOnlineOrder } = require('../lib/orderCore')
const {
  requireAuth,
  requireAdmin,
} = require('../middleware/auth')

const router = express.Router()

// =====================================================
// GET /api/admin/sales
//
// ประวัติการขายสำหรับ Admin
//
// ตัวอย่าง:
// /api/admin/sales
// /api/admin/sales?from=2026-10-01&to=2026-10-05
// /api/admin/sales?branchId=1
// =====================================================

router.get(
  '/sales',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // -------------------------------------------------
      // รับวันที่
      // -------------------------------------------------

      const from = req.query.from
      const to = req.query.to

      let fromDate

      if (from) {
        fromDate = new Date(
          `${from}T00:00:00`
        )
      } else {
        fromDate = new Date()

        fromDate.setHours(
          0,
          0,
          0,
          0
        )
      }

      let toDate

      if (to) {
        toDate = new Date(
          `${to}T23:59:59.999`
        )
      } else {
        toDate = new Date()
      }

      // -------------------------------------------------
      // ตรวจสอบวันที่
      // -------------------------------------------------

      if (
        Number.isNaN(
          fromDate.getTime()
        ) ||
        Number.isNaN(
          toDate.getTime()
        )
      ) {
        return res.status(400).json({
          error: 'รูปแบบวันที่ไม่ถูกต้อง',
        })
      }

      if (fromDate > toDate) {
        return res.status(400).json({
          error:
            'วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด',
        })
      }

      // -------------------------------------------------
      // FILTER สาขา
      //
      // ถ้ามี branchId = ดูเฉพาะสาขานั้น
      // ถ้าไม่มี branchId = ดูทุกสาขา
      // -------------------------------------------------

      const branchId =
        req.query.branchId &&
        req.query.branchId !== 'all'
          ? Number(req.query.branchId)
          : null

      if (
        branchId !== null &&
        !Number.isInteger(branchId)
      ) {
        return res.status(400).json({
          error: 'branchId ไม่ถูกต้อง',
        })
      }

      // -------------------------------------------------
      // FILTER ช่องทาง
      // -------------------------------------------------

      const channel =
        req.query.channel &&
        req.query.channel !== 'all'
          ? String(req.query.channel)
          : null

      // -------------------------------------------------
      // WHERE
      // -------------------------------------------------

      const where = {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },

        status: 'completed',
      }

      // ถ้าเลือกสาขา
      if (branchId !== null) {
        where.branchId = branchId
      }

      // ถ้าเลือกช่องทาง
      //
      // ช่องทางการชำระเงินจริงอยู่ใน Payment.method
      //
      if (channel) {
        where.payments = {
          some: {
            method: channel,
          },
        }
      }

      // -------------------------------------------------
      // ดึง Order จากฐานข้อมูลเดียวกับ POS
      // -------------------------------------------------

      const orders =
        await prisma.order.findMany({
          where,

          include: {
            branch: true,

            items: {
              include: {
                menu: true,
              },
            },

            payments: true,

            promotion: true,
          },

          orderBy: {
            createdAt: 'desc',
          },
        })

      // -------------------------------------------------
      // จัดรูปข้อมูลสำหรับ Frontend
      // -------------------------------------------------

      const result =
        orders.map(order => {

          const payment =
            order.payments?.[0]

          return {
            id: order.id,

            orderId: order.id,

            receiptNo:
              order.receiptNo,

            branchId:
              order.branchId,

            branchName:
              order.branch?.name ||
              (
                order.branchId
                  ? `สาขา ${order.branchId}`
                  : 'ไม่ระบุสาขา'
              ),

            createdAt:
              order.createdAt,

            status:
              order.status,

            subtotalAmount:
              Number(
                order.subtotalAmount || 0
              ),

            discountAmount:
              Number(
                order.discountAmount || 0
              ),

            totalAmount:
              Number(
                order.totalAmount || 0
              ),

            // ช่องทางชำระเงิน
            channel:
              payment?.method ||
              order.orderChannel ||
              'unknown',

            paymentMethod:
              payment?.method ||
              order.orderChannel ||
              'unknown',

            // Payment ทั้งหมด
            payments:
              order.payments.map(
                p => ({
                  id: p.id,

                  method:
                    p.method,

                  amount:
                    Number(
                      p.amount || 0
                    ),

                  refNo:
                    p.refNo,

                  paidAt:
                    p.paidAt,
                })
              ),

            // รายการสินค้า
            items:
              order.items.map(
                item => ({
                  id: item.id,

                  menuId:
                    item.menuId,

                  name:
                    item.menu?.name ||
                    'ไม่ทราบชื่อสินค้า',

                  category:
                    item.menu?.category ||
                    'other',

                  qty:
                    Number(
                      item.qty || 0
                    ),

                  size:
                    item.size ||
                    'full',

                  unitPrice:
                    Number(
                      item.unitPrice || 0
                    ),

                  discountAmount:
                    Number(
                      item.discountAmount || 0
                    ),

                  lineTotal:
                    Number(
                      item.lineTotal || 0
                    ),
                })
              ),

            promotion:
              order.promotion
                ? {
                    id:
                      order.promotion.id,

                    name:
                      order.promotion.name,
                  }
                : null,
          }
        })

      // -------------------------------------------------
      // ยอดขายรวม
      // -------------------------------------------------

      const sales =
        result.reduce(
          (sum, order) =>
            sum +
            Number(
              order.totalAmount || 0
            ),
          0
        )

      // -------------------------------------------------
      // ส่งข้อมูลกลับ Frontend
      // -------------------------------------------------

      res.json({
        branchId,

        from:
          fromDate.toISOString(),

        to:
          toDate.toISOString(),

        summary: {
          sales,

          orders:
            result.length,
        },

        // Frontend ปัจจุบันของพี่อ่าน sales
        sales:
          result,

        // เก็บ orders ไว้ด้วยเพื่อรองรับ
        // โค้ดส่วนอื่นในอนาคต
        orders:
          result,
      })

    } catch (error) {

      console.error(
        'Admin Sales Error:',
        error
      )

      res.status(500).json({
        error:
          'ไม่สามารถโหลดประวัติการขายได้',

        detail:
          error.message,
      })
    }
  }
)


// =====================================================
// ออเดอร์ออนไลน์รอตรวจสอบการโอนเงิน
// GET /api/admin/customer-orders/pending
// =====================================================
router.get('/customer-orders/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { orderChannel: 'online', status: 'pending_payment' },
      include: { branch: true, items: { include: { menu: true } } },
      orderBy: { createdAt: 'asc' },
    })
    res.json(orders.map(o => ({
      id: o.id, receiptNo: o.receiptNo, branchId: o.branchId,
      branchName: o.branch?.name || `สาขา ${o.branchId}`,
      customerName: o.customerName, customerPhone: o.customerPhone,
      totalAmount: Number(o.totalAmount || 0), createdAt: o.createdAt,
      deliveryMethod: o.deliveryMethod || 'pickup', deliveryAddress: o.deliveryAddress,
      items: o.items.map(i => ({ name: i.menu?.name || '-', size: i.size, qty: i.qty, lineTotal: Number(i.lineTotal || 0) })),
    })))
  } catch (error) {
    console.error('Pending customer orders error:', error)
    res.status(500).json({ error: 'ไม่สามารถโหลดออเดอร์รอตรวจสอบได้' })
  }
})

// =====================================================
// แอดมินยืนยันได้หลังตรวจรายการเงินเข้าบัญชีจริงเท่านั้น
// POST /api/admin/customer-orders/:id/confirm-payment
// body: { bankReference: "เลขอ้างอิงหรือหมายเหตุที่ตรวจสอบแล้ว" }
// =====================================================
router.post('/customer-orders/:id/confirm-payment', requireAuth, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id)
  const bankReference = String(req.body?.bankReference || '').trim().slice(0, 100)
  if (!Number.isInteger(orderId)) return res.status(400).json({ error: 'รหัสออเดอร์ไม่ถูกต้อง' })
  try {
    // มีสลิปแนบแล้ว = ไม่บังคับกรอกเลขอ้างอิง / ไม่มีสลิป = ต้องระบุเลขอ้างอิงจากรายการเดินบัญชี
    const slipRow = await prisma.order.findUnique({ where: { id: orderId }, select: { slipUrl: true } })
    if (!slipRow?.slipUrl && bankReference.length < 3) {
      return res.status(400).json({ error: 'กรุณาระบุเลขอ้างอิง/หมายเหตุหลังตรวจสอบเงินเข้าจริงแล้ว' })
    }
    const result = await prisma.$transaction(tx =>
      confirmOnlineOrder(tx, orderId, {
        staffId: req.staff.id,
        reference: bankReference || 'ตรวจสลิปโดยแอดมิน',
        label: 'แอดมินยืนยันออเดอร์ออนไลน์หลังตรวจสอบเงินเข้า',
      })
    )
    res.json({ ok: true, id: result.id, status: result.status, message: 'ยืนยันการชำระและตัดสต็อกแล้ว' })
  } catch (error) {
    const status = error.status || 500
    console.error('Confirm customer payment error:', error)
    res.status(status).json({ error: status === 500 ? 'ยืนยันการชำระไม่สำเร็จ กรุณาตรวจสอบสต็อกและบันทึกของออเดอร์' : error.message })
  }
})

module.exports = router