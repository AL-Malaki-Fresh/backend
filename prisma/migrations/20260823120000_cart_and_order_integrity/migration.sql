-- Cart: enforce one cart per logged-in user. Postgres treats NULLs as
-- distinct under a unique index, so this still allows unlimited guest
-- carts (user_id IS NULL) — see schema.prisma's Cart model for details.
-- This also fixes a race where two rapid "add to cart" calls for a
-- brand-new user could create two separate carts and silently split items,
-- since getOrCreateUserCart() now upserts on this constraint.
CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

-- CartItem: prevent two rows for the same product in the same cart when no
-- variant is selected (variant selection isn't implemented yet, so
-- variant_id is always NULL today). This is a partial index because a plain
-- unique index would not stop concurrent "add to cart" calls from creating
-- two rows for the same product — the same NULL-vs-NULL gap as above.
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_no_variant_key"
  ON "cart_items"("cart_id", "product_id")
  WHERE "variant_id" IS NULL;

-- Order: stop silently orphaning order history when a user is deleted. Was
-- ON DELETE SET NULL; deleting a user with past orders now fails instead —
-- deactivate (isActive: false) users with order history rather than
-- hard-deleting them.
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
