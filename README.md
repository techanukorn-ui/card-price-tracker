# card-price-tracker

เว็บแอปติดตามราคาการ์ดสะสม (Pokémon / Sports) — Next.js (App Router) + Tailwind CSS + Supabase

## ฟีเจอร์

- แท็บ **การ์ดของฉัน**: รูป, ชื่อ, เกรด, ราคาซื้อ, ราคาตลาดล่าสุด (เยน + บาท), "อัปเดตล่าสุดเมื่อ...", กำไร/ขาดทุน (บาท + %)
- แท็บ **Wishlist**: เหมือนกันแต่ไม่มีราคาซื้อ/กำไรขาดทุน + ปุ่ม "ย้ายเข้าคอลเลกชัน"
- เพิ่ม/แก้ไข/ลบการ์ด ทั้งสองแท็บ พร้อมอัปโหลดรูปเอง (เก็บใน Supabase Storage)
- กราฟราคาย้อนหลังต่อการ์ด 1 ใบ
- Dashboard สรุปภาพรวม: ต้นทุนรวม, มูลค่าตลาดรวม, กำไร/ขาดทุนรวม, margin % รวม, กราฟเทียบต้นทุนรวม vs มูลค่าตลาดรวมตามเวลา
- การ์ดที่ยังไม่เคยมีราคาใน `price_history` จะโชว์ "ยังไม่มีราคา" แทนเลข 0

**แอปนี้ไม่ดึงราคาจาก SNKRDUNK เอง** — เป็นแค่หน้าจอ "อ่าน" ราคาที่มีอยู่ใน Supabase มาโชว์ ราคาจะถูกเติมเข้ามาจากภายนอกผ่าน Supabase client โดยตรง หรือผ่าน `POST /api/update-price`

## Database schema

ดู [`supabase/schema.sql`](./supabase/schema.sql) — รันไฟล์นี้ทั้งไฟล์ใน Supabase SQL editor ของโปรเจกต์ใหม่ครั้งเดียว จะได้ตาราง `cards`, `price_history`, RLS policy (เปิดอ่าน/เขียนทั้งหมด เพราะเป็นแอปส่วนตัวไม่มีระบบ login), storage bucket `card-images` พร้อม seed ข้อมูลการ์ด PSA10 เริ่มต้น 18 ใบ

### ตาราง `cards`

| column | type | note |
| --- | --- | --- |
| id | uuid | primary key |
| name | text | ชื่อที่เรียกเอง |
| grade | text | Raw / PSA9 / PSA10 ฯลฯ |
| cost_thb | numeric | ราคาซื้อ (บาท), null สำหรับ wishlist |
| snkrdunk_url | text | |
| image_url | text | auto จาก SNKRDUNK (เติมทีหลังโดยกระบวนการภายนอก) |
| custom_image_url | text | รูปที่อัปโหลดเอง |
| is_wishlist | boolean | |
| created_at | timestamptz | |

### ตาราง `price_history`

| column | type | note |
| --- | --- | --- |
| id | uuid | primary key |
| card_id | uuid | FK → cards.id |
| market_price_jpy | numeric | |
| market_price_thb | numeric | |
| exchange_rate | numeric | |
| fetched_at | timestamptz | เก็บทุกครั้งที่มีราคาใหม่ ไม่เขียนทับของเก่า |

## การเติมราคาเข้าฐานข้อมูล (จากภายนอกแอปนี้)

สองทางเลือก:

1. เขียนตรงผ่าน Supabase client (anon key เปิดเขียนได้อยู่แล้ว — ดู RLS policy ใน schema.sql):
   ```js
   await supabase.from('price_history').insert({
     card_id, market_price_jpy, market_price_thb, exchange_rate,
   })
   ```
2. เรียก API route ของแอปนี้:
   ```
   POST https://<your-deployment>/api/update-price
   Content-Type: application/json

   { "card_id": "...", "market_price_jpy": 12345, "exchange_rate": 0.24 }
   ```
   `market_price_thb` จะถูกคำนวณอัตโนมัติจาก `market_price_jpy * exchange_rate` ถ้าไม่ได้ส่งมาตรงๆ

## รันโปรเจกต์เอง (local dev)

ต้องมี Node.js 18+

```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่า Supabase project ของคุณ
npm run dev
```

## Environment variables (ตั้งใน Vercel)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (สำหรับ `/api/update-price`, optional — ถ้าไม่ตั้งจะ fallback ไปใช้ anon key)
- `ADMIN_PASSWORD` (รหัสผ่านปลดล็อกโหมดแก้ไข)

## ดึงราคาจาก SNKRDUNK แบบอัตโนมัติ

ดู [`browser-extension/README.md`](./browser-extension/README.md) — เป็น Chrome extension ที่ให้ปุ่ม "ดึงราคาใหม่" / "ดึงราคาทั้งหมด" บนเว็บนี้ทำงานได้จริง โหลดแบบ unpacked ผ่าน `chrome://extensions` (ต้องทำใหม่ทุกเครื่องที่จะใช้ปุ่มนี้ ไม่ได้ติดมากับ `git clone`)
