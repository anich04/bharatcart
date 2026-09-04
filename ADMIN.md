# Running your BharatCart store

A plain-English guide for the shop owner. No technical knowledge needed.

Everything happens at **yourstore.com/admin**. Sign in with your admin email and
password. If you can't see the Admin area, your account doesn't have admin
rights — ask your developer to set your role to `ADMIN`.

---

## The dashboard

The first page shows how the shop is doing. Use the buttons at the top to switch
between **7 days / 30 days / 90 days / All time**.

- **Revenue** — money from orders that were actually paid or accepted (it
  ignores abandoned/unpaid orders).
- **Orders** — how many orders in the period.
- **Avg. order value** — revenue ÷ orders.
- **Awaiting payment** — customers who started checkout but haven't paid. These
  are normal; they usually resolve themselves.
- **Top products** and **Recent orders** are underneath.

If stock is running out, an amber bar appears — click it to go to **Low stock**.

---

## Adding a product

**Admin → Products → + New product**

1. **Title** — what customers see, e.g. "Kosha Men's Cotton Kurta".
   The web address (*slug*) fills in automatically.
2. **Description** — a few honest sentences.
3. **Category** and **Brand** — pick from the dropdowns.
4. **GST rate** — the tax slab for this item (5%, 12%, 18%, 28%). If unsure,
   ask your accountant. **HSN code** goes on the invoice.
5. **Variants & stock** — this is the important bit:
   - Every product needs **at least one** variant row.
   - If the product has no options (one kitchen pan), leave one row and label it
     `Default`.
   - If it comes in sizes or colours, add one row per combination, e.g.
     `M / Red`, `L / Red`, `M / Blue`.
   - **SKU** is your own code for that exact variant — it must be unique.
   - **Price** is what the customer pays, **in rupees, including GST**.
   - **MRP** is the crossed-out "before" price. Set it equal to Price if there's
     no discount.
   - **Stock** is how many you physically have.
6. **Images** — paste image links, one per line. (Upload photos to Cloudinary
   first; your developer can set this up.) Use only your own or licensed
   photos — never images copied from another website.
7. **Status**:
   - **Draft** — not visible to customers. Use while you're still writing it.
   - **Active** — live on the shop.
   - **Archived** — hidden, but past orders keep working.
8. Click **Save product**.

> **Tip:** Tick **Featured** to show it on the home page, or **New arrival** to
> put it in the "New arrivals" row.

### Changing a product later

**Admin → Products**, click the product, edit, **Save product**. Removing a
variant row hides it from the shop but keeps old orders intact.

### Adding many products at once

**Admin → Products → Import CSV.** Click **Load a sample row** to see the exact
format. Fill it in a spreadsheet, save as CSV, then upload. Prices are in
rupees. Re-uploading the same file **updates** those products instead of
creating duplicates. Any rows it couldn't use are listed with the reason.

---

## Processing an order

**Admin → Orders.** Filter by status along the top, or search by order number,
customer name or phone.

Click an order to see the items, the delivery address, the payment, and the
**Manage order** panel on the right.

### The normal journey

**Confirmed → Packed → Shipped → Delivered**

1. **Confirmed** — the customer paid (or chose Cash on Delivery). Start packing.
2. Pack the items, then set the status to **Packed**.
3. Enter the **Carrier** (e.g. Delhivery) and **Tracking number**, click
   **Save tracking**.
4. Set the status to **Shipped**. ⚠️ *This emails the customer their tracking
   number, so save the tracking number **first**.*
5. When it arrives, set **Delivered**. (Customers can only review a product
   after it's marked Delivered.)

### If something goes wrong

- **Cancelled** — the order won't be fulfilled. **The stock is automatically put
  back.**
- **Returned** — the customer sent it back. **Stock is put back automatically.**
- Statuses only move forwards along sensible paths, so you can't accidentally
  mark a delivered order as unpaid.

### "Awaiting payment" / Pending orders

The customer started paying and didn't finish. Leave them alone — if the money
actually went through, the system updates the order by itself within a few
minutes. Never mark one as paid manually.

---

## Issuing a refund

Open the order → **Manage order** → **Refund**.

- Only for orders paid **online**. You'll be asked to confirm.
- The money goes back to the customer's original payment method. Razorpay
  usually takes 5–7 working days.
- The order shows **Refunded** once Razorpay confirms it — that can take a few
  minutes. This is normal; don't click refund twice.
- **Cash on Delivery orders cannot be refunded here** — you settle those in cash
  or by bank transfer yourself, then mark the order **Returned**.

---

## Stock

**Admin → Low stock** lists anything at or below 5 units (change the number and
click Apply). Type the new number and click **Save** to correct stock after a
delivery or a stock-take.

Stock goes down automatically when an order is confirmed, and back up
automatically if you cancel or return an order.

---

## Discount codes

**Admin → Coupons → + New coupon.**

- **Code** — what the customer types, e.g. `DIWALI20`. Letters and numbers.
- **Type** — *Percentage* (e.g. 20%) or *Flat amount* (e.g. ₹200 off).
- **Min order** — the code only works above this value. Use this to protect your
  margin.
- **Max discount** — a ceiling for percentage codes, e.g. "20% off, up to ₹500".
- **Total uses** / **Uses per customer** — leave blank for unlimited.
- **Starts / Expires** — leave blank for no limit.

**Disable** switches a code off instantly without deleting its history.

---

## Reviews

**Admin → Reviews.** Only customers who actually received the product can
review it, so spam is rare. If a review is abusive, click **Hide** — it
disappears from the shop and stops counting toward the star rating. **Unhide**
reverses it.

---

## Customers

**Admin → Customers** shows everyone who has signed up, how many orders they've
placed, and how much they've spent. Search by name, email or phone.

---

## Things to be careful about

- **Never share your admin password.** Anyone with it can refund money.
- **Prices include GST.** Enter the final price the customer pays.
- **Save the tracking number before marking an order Shipped** — that's what
  triggers the customer's email.
- **Don't delete products that have been ordered.** Use **Archived** instead, so
  old invoices stay correct.
- If money looks wrong anywhere, take a screenshot and contact your developer
  before changing anything.
