const express = require('express');
const prisma = require('../db');
const { requireAuth, requireDept } = require('../middleware/auth');

// ออเดอร์/ประวัติ สำหรับฝ่ายขาย (และ Admin) เท่านั้น
const salesOnly = [requireAuth, requireDept('sales')];

const router = express.Router();


// =====================================================
// เมนูที่สามารถขายครึ่งตัวได้
// =====================================================

function supportsHalfOption(category) {
  return (
    category === 'duck' ||
    category === 'chicken'
  );
}


// =====================================================
// GET /api/orders/history?branchId=1&from=ISO&to=ISO
// ประวัติการสั่งซื้อ
//
// - ถ้าส่ง from / to (เวลาเริ่มต้น-สิ้นสุดของ "วัน" ที่เลือก จากหน้าเว็บ)
//   จะได้เฉพาะออเดอร์ในช่วงนั้น
// - ถ้าไม่ส่ง จะใช้ "วันนี้" ตามเวลาเครื่องเซิร์ฟเวอร์
//   => ประวัติเริ่มที่ 0 ใหม่ทุกวัน
// =====================================================

router.get('/history', salesOnly, async (req, res) => {

  try {

    const branchId =
      req.query.branchId
        ? Number(req.query.branchId)
        : undefined;

    let from;
    let to;

    if (req.query.from && req.query.to) {
      from = new Date(String(req.query.from));
      to = new Date(String(req.query.to));
    }

    if (
      !from || !to ||
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      from = new Date();
      from.setHours(0, 0, 0, 0);

      to = new Date(from.getTime() + 24 * 3600 * 1000);
    }

    const orders =
      await prisma.order.findMany({

        where: {
          ...(branchId ? { branchId } : {}),
          createdAt: {
            gte: from,
            lt: to,
          },
        },

        include: {
          items: {
            include: {
              menu: true,
            },
          },
          payments: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

      });

    res.json(orders);

  } catch (error) {

    console.error(
      'GET /orders/history error:',
      error
    );

    res.status(500).json({
      error: 'ไม่สามารถโหลดประวัติการขายได้',
    });

  }

});


// =====================================================
// POST /api/orders
// สร้างออเดอร์ + ตัดสต็อก
// =====================================================

router.post('/', salesOnly, async (req, res) => {

  const {
    branchId,
    items,
    promotionId,
    payments,
    localId,
    clientCreatedAt,
  } = req.body;

  // -----------------------------------------------------
  // localId = รหัสกันบันทึกซ้ำ (หน้าเว็บสร้างให้ 1 ครั้งต่อ 1 การขาย)
  // ถ้าเน็ตหลุดแล้วส่งซ้ำ จะได้ออเดอร์เดิม ไม่ตัดสต็อกซ้ำ
  // -----------------------------------------------------
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const validLocalId =
    typeof localId === 'string' && UUID_RE.test(localId)
      ? localId.toLowerCase()
      : null;

  // เวลาที่ขายจริง (กรณีขายตอนออฟไลน์แล้วค่อยซิงค์) ย้อนหลังได้ไม่เกิน 7 วัน
  let soldAt = null;

  if (clientCreatedAt) {
    const t = new Date(clientCreatedAt);
    const now = Date.now();

    if (
      !Number.isNaN(t.getTime()) &&
      t.getTime() <= now + 60 * 1000 &&
      t.getTime() >= now - 7 * 24 * 3600 * 1000
    ) {
      soldAt = t;
    }
  }

  async function replyExisting() {
    const existing = await prisma.order.findFirst({
      where: { localId: validLocalId },
      include: { items: true, payments: true },
    });

    if (!existing) return false;

    res.status(200).json({
      order: existing,
      receiptNo: existing.receiptNo,
      subtotal: Number(existing.subtotalAmount),
      discount: Number(existing.discountAmount),
      total: Number(existing.totalAmount),
      duplicate: true,
    });

    return true;
  }


  if (
    !branchId ||
    !Array.isArray(items) ||
    items.length === 0
  ) {

    return res.status(400).json({
      error:
        'ต้องระบุ branchId และ items อย่างน้อย 1 รายการ',
    });

  }


  try {

    if (validLocalId && (await replyExisting())) {
      return;
    }

    const result =
      await prisma.$transaction(async (tx) => {

        let subtotal = 0;

        const lineItems = [];


        // =================================================
        // 1. ตรวจสอบสินค้า + ตรวจสต็อก
        // =================================================

        for (const item of items) {

          const menu =
            await tx.menu.findUnique({

              where: {
                id: Number(item.menuId),
              },

            });


          if (!menu) {

            throw new Error(
              `ไม่พบเมนู id ${item.menuId}`
            );

          }


          // -----------------------------------------------
          // สำคัญ:
          // เป็ดและไก่รองรับครึ่งตัวเสมอ
          // แม้ค่า hasHalfOption ใน DB จะยังเป็น false
          // -----------------------------------------------

          const hasHalfOption =
            Boolean(menu.hasHalfOption) ||
            supportsHalfOption(menu.category);


          // -----------------------------------------------
          // ตรวจสอบว่า size ถูกต้อง
          // -----------------------------------------------

          const itemSize =
            item.size === 'half'
              ? 'half'
              : 'full';


          // -----------------------------------------------
          // จำนวนหน่วยที่ต้องตัด
          //
          // ครึ่งตัว = 1 หน่วย
          // เต็มตัว = 2 หน่วย
          // สินค้าปกติ = 1 หน่วย
          // -----------------------------------------------

          const factor =
            hasHalfOption
              ? 2
              : 1;


          const halfUnitsNeeded =
            itemSize === 'half'
              ? Number(item.qty)
              : Number(item.qty) * factor;


          // -----------------------------------------------
          // ตรวจสต็อก
          // -----------------------------------------------

          const stock =
            await tx.branchStock.findUnique({

              where: {
                branchId_menuId: {
                  branchId: Number(branchId),
                  menuId: Number(item.menuId),
                },
              },

            });


          if (
            !stock ||
            Number(stock.qty) < halfUnitsNeeded
          ) {

            throw new Error(
              `สต็อกไม่พอสำหรับเมนู "${menu.name}"`
            );

          }


          // -----------------------------------------------
          // ราคา
          // -----------------------------------------------

          const unitPrice =
            itemSize === 'half' && hasHalfOption
              ? Number(menu.price) / 2
              : Number(menu.price);


          const lineTotal =
            unitPrice * Number(item.qty);


          subtotal += lineTotal;


          // เก็บข้อมูลไว้ใช้ตอนสร้าง order
          lineItems.push({

            ...item,

            menuId: Number(item.menuId),

            size: itemSize,

            qty: Number(item.qty),

            unitPrice,

            lineTotal,

            halfUnitsNeeded,

          });

        }


        // =================================================
        // 2. โปรโมชั่น
        // =================================================

        let discount = 0;

        let promo = null;


        if (promotionId) {

          promo =
            await tx.promotion.findUnique({

              where: {
                id: Number(promotionId),
              },

            });


          if (
            promo &&
            promo.active &&
            subtotal >=
              Number(
                promo.minOrderAmount || 0
              )
          ) {

            if (
              promo.type === 'percent'
            ) {

              discount =
                subtotal *
                (
                  Number(promo.value) / 100
                );

            }


            if (
              promo.type === 'fixed_amount'
            ) {

              discount =
                Number(promo.value);

            }

          }

        }


        const total =
          Math.max(
            subtotal - discount,
            0
          );


        // =================================================
        // 3. เลขที่ใบเสร็จ
        // =================================================

        const today =
          new Date();


        // วันที่ตามเวลาเครื่อง (ไม่ใช้ UTC เพราะจะคลาดเคลื่อนช่วงเที่ยงคืน)
        const datePart =
          `${today.getFullYear()}${String(
            today.getMonth() + 1
          ).padStart(2, '0')}${String(
            today.getDate()
          ).padStart(2, '0')}`;


        const countToday =
          await tx.order.count({

            where: {

              branchId: Number(branchId),

              createdAt: {
                gte:
                  new Date(
                    today.toDateString()
                  ),
              },

            },

          });


        const receiptNo =
          `B${branchId}-${datePart}-${String(
            countToday + 1
          ).padStart(4, '0')}`;


        // =================================================
        // 4. สร้าง Order
        // =================================================

        const order =
          await tx.order.create({

            data: {

              branchId: Number(branchId),

              staffId:
                req.staff.id,

              receiptNo,

              subtotalAmount:
                subtotal,

              promotionId:
                promo
                  ? promo.id
                  : null,

              discountAmount:
                discount,

              totalAmount:
                total,

              status:
                'completed',

              localId:
                validLocalId,

              ...(soldAt
                ? { createdAt: soldAt }
                : {}),
            },

          });


        // =================================================
        // 5. สร้าง OrderItem + ตัด Stock
        // =================================================

        for (const li of lineItems) {

          // ---------------------------------------------
          // สร้างรายการขาย
          // ---------------------------------------------

          await tx.orderItem.create({

            data: {

              orderId:
                order.id,

              menuId:
                li.menuId,

              size:
                li.size,

              qty:
                li.qty,

              unitPrice:
                li.unitPrice,

              lineTotal:
                li.lineTotal,

            },

          });


          // ---------------------------------------------
          // ตัดสต็อก
          //
          // เป็ด/ไก่เต็มตัว = -2
          // เป็ด/ไก่ครึ่งตัว = -1
          // สินค้าปกติ = -1
          // ---------------------------------------------

          await tx.branchStock.update({

            where: {

              branchId_menuId: {
                branchId:
                  Number(branchId),

                menuId:
                  li.menuId,
              },

            },

            data: {

              qty: {

                decrement:
                  li.halfUnitsNeeded,

              },

            },

          });


          // ---------------------------------------------
          // Stock Log
          // ---------------------------------------------

          await tx.stockLog.create({

            data: {

              branchId:
                Number(branchId),

              menuId:
                li.menuId,

              type:
                'out',

              qty:
                li.halfUnitsNeeded,

              note:
                `ขายออเดอร์ ${receiptNo} (${li.qty} ${li.size})`,

              staffId:
                req.staff.id,

              orderId:
                order.id,

            },

          });

        }


        // =================================================
        // 6. บันทึกการชำระเงิน
        // =================================================

        const paymentRows =
          payments &&
          payments.length
            ? payments
            : [
                {
                  method: 'cash',
                  amount: total,
                },
              ];


        for (const p of paymentRows) {

          await tx.payment.create({

            data: {

              orderId:
                order.id,

              method:
                p.method,

              amount:
                p.amount,

              refNo:
                p.refNo,

            },

          });

        }


        return {

          order,

          receiptNo,

          subtotal,

          discount,

          total,

        };

      });


    res.status(201).json(result);

  } catch (err) {

    // ส่งซ้ำพร้อมกัน (localId ชนกัน) -> ตอบออเดอร์เดิม
    if (
      err.code === 'P2002' &&
      validLocalId &&
      (await replyExisting())
    ) {
      return;
    }

    console.error(
      'POST /orders error:',
      err
    );

    res.status(400).json({
      error: err.message,
    });

  }

});


// =====================================================
// POST /api/orders/:id/cancel
// ยกเลิกออเดอร์ + คืนสต็อก
// =====================================================

router.post(
  '/:id/cancel',
  salesOnly,
  async (req, res) => {

    const id =
      Number(req.params.id);

    const {
      reason,
    } = req.body;


    try {

      const order =
        await prisma.order.update({

          where: {
            id,
          },

          data: {

            status:
              'cancelled',

            cancelReason:
              reason || null,

          },

          include: {

            items: {
              include: {
                menu: true,
              },
            },

          },

        });


      for (const item of order.items) {

        // ---------------------------------------------
        // ใช้ category ช่วยตัดสินด้วย
        // ---------------------------------------------

        const hasHalfOption =
          Boolean(
            item.menu?.hasHalfOption
          ) ||
          supportsHalfOption(
            item.menu?.category
          );


        const factor =
          hasHalfOption
            ? 2
            : 1;


        const halfUnits =
          item.size === 'half'
            ? Number(item.qty)
            : Number(item.qty) * factor;


        // ---------------------------------------------
        // คืนสต็อก
        // ---------------------------------------------

        await prisma.branchStock.update({

          where: {

            branchId_menuId: {

              branchId:
                order.branchId,

              menuId:
                item.menuId,

            },

          },

          data: {

            qty: {
              increment:
                halfUnits,
            },

          },

        });


        // ---------------------------------------------
        // Stock Log
        // ---------------------------------------------

        await prisma.stockLog.create({

          data: {

            branchId:
              order.branchId,

            menuId:
              item.menuId,

            type:
              'adjust',

            qty:
              halfUnits,

            note:
              `ยกเลิกออเดอร์ #${order.id}`,

            staffId:
              req.staff.id,

            orderId:
              order.id,

          },

        });

      }


      res.json(order);


    } catch (err) {

      console.error(
        'POST /orders/:id/cancel error:',
        err
      );

      res.status(400).json({
        error:
          err.message,
      });

    }

  }
);


module.exports = router;