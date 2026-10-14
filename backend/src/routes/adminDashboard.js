const express = require('express')
const prisma = require('../db')
const { requireAuth, requireAdmin } = require('../middleware/auth')

const router = express.Router()

// =====================================================
// Helper
// =====================================================

function num(value) {
  return Number(value || 0)
}

function parseDate(value, fallback) {
  if (!value) return fallback

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return date
}

function getDateRange(startDateValue, endDateValue) {
  const now = new Date()

  // ค่าเริ่มต้น = เดือนปัจจุบัน
  const defaultStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  )

  const defaultEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  )

  const startDate = parseDate(
    startDateValue,
    defaultStart
  )

  let endDate

  if (endDateValue) {
    const requestedEnd = parseDate(
      endDateValue,
      defaultEnd
    )

    // รวมข้อมูลทั้งวันของ endDate
    endDate = new Date(requestedEnd)
    endDate.setDate(endDate.getDate() + 1)
  } else {
    endDate = defaultEnd
  }

  return {
    startDate,
    endDate,
  }
}

// =====================================================
// คำนวณต้นทุนเมนู
//
// menu
//   ↓
// menu_recipe
//   ↓
// raw_materials
//
// หรือ
//
// menu
//   ↓
// menu_recipe
//   ↓
// prep_recipe
//   ↓
// raw_materials
// =====================================================

async function menuCostPerUnit(menuId, cache) {
  if (cache.has(menuId)) {
    return cache.get(menuId)
  }

  const recipe = await prisma.menuRecipe.findMany({
    where: {
      menuId,
    },
  })

  let cost = 0

  for (const recipeItem of recipe) {
    // -----------------------------------------------
    // เมนูใช้วัตถุดิบโดยตรง
    // -----------------------------------------------
    if (recipeItem.materialId) {
      const material =
        await prisma.rawMaterial.findUnique({
          where: {
            id: recipeItem.materialId,
          },
        })

      if (material) {
        cost +=
          Number(recipeItem.qtyPerUnit || 0) *
          Number(material.costPerUnit || 0)
      }
    }

    // -----------------------------------------------
    // เมนูใช้ของเตรียม / ของหมัก
    // -----------------------------------------------
    else if (recipeItem.prepItemId) {
      const prepRecipe =
        await prisma.prepRecipe.findMany({
          where: {
            prepItemId: recipeItem.prepItemId,
          },
        })

      let prepCost = 0

      for (const prep of prepRecipe) {
        const material =
          await prisma.rawMaterial.findUnique({
            where: {
              id: prep.materialId,
            },
          })

        if (material) {
          prepCost +=
            Number(prep.qtyPerUnit || 0) *
            Number(material.costPerUnit || 0)
        }
      }

      cost +=
        Number(recipeItem.qtyPerUnit || 0) *
        prepCost
    }
  }

  cache.set(menuId, cost)

  return cost
}


// =====================================================
// GET /api/admin/dashboard
//
// ตัวอย่าง:
//
// /api/admin/dashboard
//
// /api/admin/dashboard?startDate=2026-10-01
//
// /api/admin/dashboard?startDate=2026-10-01&endDate=2026-10-31
//
// /api/admin/dashboard?branchId=6
//
// =====================================================

router.get(
  '/dashboard',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // =================================================
      // 1. ตรวจ branch
      // =================================================

      let branchId = null

      if (
        req.query.branchId !== undefined &&
        req.query.branchId !== ''
      ) {
        branchId = Number(req.query.branchId)

        if (!Number.isInteger(branchId)) {
          return res.status(400).json({
            error: 'branchId ไม่ถูกต้อง',
          })
        }
      } else {
        // ถ้าไม่ได้เลือก branch
        // ใช้ branch ของ Admin ที่ login อยู่
        branchId = Number(
          req.staff?.branchId
        ) || null
      }


      // =================================================
      // 2. ช่วงวันที่
      // =================================================

      const {
        startDate,
        endDate,
      } = getDateRange(
        req.query.startDate,
        req.query.endDate
      )

      if (startDate >= endDate) {
        return res.status(400).json({
          error: 'ช่วงวันที่ไม่ถูกต้อง',
        })
      }


      // =================================================
      // 3. ดึง Orders
      // =================================================

      const orders =
        await prisma.order.findMany({
          where: {
            status: 'completed',

            ...(branchId
              ? {
                  branchId,
                }
              : {}),

            createdAt: {
              gte: startDate,
              lt: endDate,
            },
          },

          include: {
            items: {
              include: {
                menu: true,
              },
            },

            payments: true,

            branch: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        })


      // =================================================
      // 4. Summary
      // =================================================

      const sales =
        orders.reduce(
          (sum, order) =>
            sum +
            num(order.totalAmount),
          0
        )

      const orderCount =
        orders.length

      const discount =
        orders.reduce(
          (sum, order) =>
            sum +
            num(order.discountAmount),
          0
        )


      // =================================================
      // 5. ต้นทุนสินค้า
      // =================================================

      const costCache = new Map()

      let productCost = 0


      for (const order of orders) {
        for (const item of order.items) {
          const unitCost =
            await menuCostPerUnit(
              item.menuId,
              costCache
            )

          const qty =
            num(item.qty)

          const units =
            item.size === 'half'
              ? qty * 0.5
              : qty

          productCost +=
            unitCost * units
        }
      }


      // =================================================
      // 6. ค่าใช้จ่ายอื่น
      // =================================================

      // หมายเหตุ:
      // ตาราง other_expenses ใน schema ปัจจุบันยังไม่มี effectiveMonth
      // จึงห้ามส่งเงื่อนไข effectiveMonth ให้ Prisma เพราะจะทำให้
      // endpoint /api/admin/dashboard ล้มด้วย Prisma validation error
      //
      // ตอนนี้กรองตามสาขาเท่านั้น เพื่อให้ Dashboard โหลดได้ก่อน
      // หากต้องการกรองค่าใช้จ่ายตามช่วงวันที่ ควรเพิ่ม effective_month
      // ในฐานข้อมูลและ Prisma schema ภายหลัง
      // ค่าใช้จ่ายเดิมที่ไม่มีวันที่ (expenseDate = null) นับเหมือนเดิม
      // ค่าใช้จ่ายรายวันที่พนักงานบันทึก นับเฉพาะวันในช่วงที่เลือก
      const rangeStart = new Date(
        Date.UTC(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        )
      )

      const rangeEnd = new Date(
        Date.UTC(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate()
        )
      )

      const expenses =
        await prisma.otherExpense.findMany({
          where: {
            AND: [
              branchId
                ? {
                    OR: [
                      { branchId },
                      { branchId: null },
                    ],
                  }
                : {},
              {
                OR: [
                  { expenseDate: null },
                  {
                    expenseDate: {
                      gte: rangeStart,
                      lt: rangeEnd,
                    },
                  },
                ],
              },
            ],
          },
        })

      const otherExpenses =
        expenses.reduce(
          (sum, expense) =>
            sum +
            num(expense.amount),
          0
        )


      // =================================================
      // 7. กำไร
      // =================================================

      const totalCost =
        productCost +
        otherExpenses

      const profit =
        sales -
        totalCost


      // =================================================
      // 8. ยอดขายรายวัน
      // =================================================

      const dailyMap = {}

      for (const order of orders) {
        const date =
          order.createdAt
            .toISOString()
            .slice(0, 10)

        if (!dailyMap[date]) {
          dailyMap[date] = {
            sales: 0,
            orders: 0,
          }
        }

        dailyMap[date].sales +=
          num(order.totalAmount)

        dailyMap[date].orders += 1
      }

      const dailySales =
        Object.entries(dailyMap)
          .sort(([a], [b]) =>
            a.localeCompare(b)
          )
          .map(
            ([date, value]) => ({
              date,
              sales: value.sales,
              orders: value.orders,
            })
          )


      // =================================================
      // 9. ยอดขายรายเดือน
      // =================================================

      const monthlyMap = {}

      for (const order of orders) {
        const month =
          order.createdAt
            .toISOString()
            .slice(0, 7)

        if (!monthlyMap[month]) {
          monthlyMap[month] = {
            sales: 0,
            orders: 0,
          }
        }

        monthlyMap[month].sales +=
          num(order.totalAmount)

        monthlyMap[month].orders += 1
      }

      const monthlySales =
        Object.entries(monthlyMap)
          .sort(([a], [b]) =>
            a.localeCompare(b)
          )
          .map(
            ([month, value]) => ({
              month,
              sales: value.sales,
              orders: value.orders,
            })
          )


      // =================================================
      // 10. ยอดขายตามหมวดสินค้า
      // =================================================

      const categoryMap = {}

      for (const order of orders) {
        for (const item of order.items) {
          const category =
            item.menu?.category ||
            'other'

          if (!categoryMap[category]) {
            categoryMap[category] = {
              category,
              sales: 0,
              qty: 0,
            }
          }

          categoryMap[category].sales +=
            num(item.lineTotal)

          categoryMap[category].qty +=
            item.size === 'half'
              ? num(item.qty) * 0.5
              : num(item.qty)
        }
      }

      const categorySales =
        Object.values(categoryMap)
          .sort(
            (a, b) =>
              b.sales - a.sales
          )


      // =================================================
      // 11. ยอดขายตามช่องทาง
      //
      // เช่น:
      // cash
      // qr
      // transfer
      // card
      // =================================================

      const channelMap = {}

      for (const order of orders) {
        for (const payment of order.payments || []) {
          const method =
            payment.method ||
            'unknown'

          if (!channelMap[method]) {
            channelMap[method] = {
              channel: method,
              sales: 0,
              orders: 0,
            }
          }

          channelMap[method].sales +=
            num(payment.amount)

          channelMap[method].orders +=
            1
        }
      }

      const channelSales =
        Object.values(channelMap)
          .sort(
            (a, b) =>
              b.sales - a.sales
          )


      // =================================================
      // 12. ส่งข้อมูลกลับ
      // =================================================

      return res.json({
        period: {
          startDate:
            startDate.toISOString(),

          endDate:
            endDate.toISOString(),
        },

        branchId,

        summary: {
          sales,
          orders: orderCount,
          discount,
          productCost,
          otherExpenses,
          totalCost,
          profit,
        },

        dailySales,

        monthlySales,

        categorySales,

        channelSales,
      })

    } catch (err) {
      console.error(
        'Admin Dashboard Error:',
        err
      )

      return res.status(500).json({
        error:
          'ไม่สามารถโหลดข้อมูล Admin Dashboard ได้',

        detail:
          err.message,
      })
    }
  }
)


// =====================================================
// GET /api/admin/dashboard/daily-series
//
// ใช้สำหรับกราฟยอดขายรายวัน
//
// /api/admin/dashboard/daily-series?month=2026-10
// /api/admin/dashboard/daily-series?month=2026-10&branchId=6
// =====================================================

router.get(
  '/dashboard/daily-series',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      let branchId = null

      if (
        req.query.branchId !== undefined &&
        req.query.branchId !== ''
      ) {
        branchId =
          Number(req.query.branchId)

        if (!Number.isInteger(branchId)) {
          return res.status(400).json({
            error: 'branchId ไม่ถูกต้อง',
          })
        }
      } else {
        branchId =
          Number(
            req.staff?.branchId
          ) || null
      }


      const month =
        req.query.month ||
        new Date()
          .toISOString()
          .slice(0, 7)


      const base =
        new Date(`${month}-01T00:00:00`)


      if (Number.isNaN(base.getTime())) {
        return res.status(400).json({
          error:
            'รูปแบบเดือนต้องเป็น YYYY-MM',
        })
      }


      const start =
        new Date(
          base.getFullYear(),
          base.getMonth(),
          1
        )

      const end =
        new Date(
          base.getFullYear(),
          base.getMonth() + 1,
          1
        )


      const orders =
        await prisma.order.findMany({
          where: {
            status: 'completed',

            ...(branchId
              ? {
                  branchId,
                }
              : {}),

            createdAt: {
              gte: start,
              lt: end,
            },
          },

          select: {
            totalAmount: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: 'asc',
          },
        })


      const dayMap = {}

      for (const order of orders) {
        const date =
          order.createdAt
            .toISOString()
            .slice(0, 10)

        if (!dayMap[date]) {
          dayMap[date] = 0
        }

        dayMap[date] +=
          num(order.totalAmount)
      }


      // สร้างครบทุกวัน
      // วันที่ไม่มียอดขาย = 0

      const series = []

      const cursor =
        new Date(start)

      while (cursor < end) {
        const date =
          cursor
            .toISOString()
            .slice(0, 10)

        series.push({
          date,
          revenue:
            dayMap[date] || 0,
        })

        cursor.setDate(
          cursor.getDate() + 1
        )
      }


      return res.json({
        month:
          start
            .toISOString()
            .slice(0, 7),

        branchId,

        series,
      })

    } catch (err) {
      console.error(
        'Admin Daily Series Error:',
        err
      )

      return res.status(500).json({
        error:
          'ไม่สามารถโหลดกราฟยอดขายรายวันได้',

        detail:
          err.message,
      })
    }
  }
)


// =====================================================
// GET /api/admin/dashboard/branches-compare
//
// เปรียบเทียบยอดขายแต่ละสาขา
//
// /api/admin/dashboard/branches-compare
//
// /api/admin/dashboard/branches-compare
// ?startDate=2026-10-01
// &endDate=2026-10-31
// =====================================================

router.get(
  '/dashboard/branches-compare',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        startDate,
        endDate,
      } = getDateRange(
        req.query.startDate,
        req.query.endDate
      )


      if (startDate >= endDate) {
        return res.status(400).json({
          error:
            'ช่วงวันที่ไม่ถูกต้อง',
        })
      }


      const orders =
        await prisma.order.findMany({
          where: {
            status: 'completed',

            createdAt: {
              gte: startDate,
              lt: endDate,
            },
          },

          select: {
            branchId: true,
            totalAmount: true,
          },
        })


      const branches =
        await prisma.branch.findMany({
          orderBy: {
            id: 'asc',
          },
        })


      const result =
        branches.map(
          (branch) => {
            const branchOrders =
              orders.filter(
                (order) =>
                  order.branchId ===
                  branch.id
              )


            const revenue =
              branchOrders.reduce(
                (sum, order) =>
                  sum +
                  num(
                    order.totalAmount
                  ),
                0
              )


            return {
              branchId:
                branch.id,

              branchName:
                branch.name,

              orderCount:
                branchOrders.length,

              revenue,
            }
          }
        )


      return res.json(result)

    } catch (err) {
      console.error(
        'Admin Branch Compare Error:',
        err
      )

      return res.status(500).json({
        error:
          'ไม่สามารถเปรียบเทียบข้อมูลสาขาได้',

        detail:
          err.message,
      })
    }
  }
)


module.exports = router