-- อัปเกรดรอบ 4: กะการขาย, ค่าใช้จ่ายรายวัน, กันออเดอร์ซ้ำ
-- รันครั้งเดียวใน PostgreSQL แล้วสั่ง `npx prisma generate` ในโฟลเดอร์ backend

-- 1) ค่าใช้จ่ายรายวัน (ข้อมูลเดิม expense_date = NULL ยังนับเหมือนเดิมในหน้า Admin)
ALTER TABLE other_expenses ADD COLUMN IF NOT EXISTS expense_date DATE;
ALTER TABLE other_expenses ADD COLUMN IF NOT EXISTS staff_id INT;
ALTER TABLE other_expenses ADD COLUMN IF NOT EXISTS paid_from_drawer BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE other_expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- 2) กะการขาย
CREATE TABLE IF NOT EXISTS shifts (
  id            SERIAL PRIMARY KEY,
  branch_id     INT NOT NULL REFERENCES branches(id),
  staff_id      INT REFERENCES staff(id),
  opened_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  opening_cash  NUMERIC(10,2) NOT NULL DEFAULT 0,
  closed_at     TIMESTAMP,
  counted_cash  NUMERIC(10,2),
  expected_cash NUMERIC(10,2),
  difference    NUMERIC(10,2),
  note          VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS shifts_branch_open_idx ON shifts (branch_id, closed_at);

-- 3) กันบันทึกออเดอร์ซ้ำ (ใช้กับการขายตอนออฟไลน์แล้วซิงค์)
CREATE UNIQUE INDEX IF NOT EXISTS orders_local_id_key ON orders (local_id) WHERE local_id IS NOT NULL;
