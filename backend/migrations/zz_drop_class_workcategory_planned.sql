-- order_works: убираем class, workCategoryId, countTotalPlanned, hourTotalPlanned
ALTER TABLE order_works DROP COLUMN IF EXISTS "class";
ALTER TABLE order_works DROP COLUMN IF EXISTS "workCategoryId";
ALTER TABLE order_works DROP COLUMN IF EXISTS "countTotalPlanned";
ALTER TABLE order_works DROP COLUMN IF EXISTS "hourTotalPlanned";

-- product_work_norms: убираем class, workCategoryId
ALTER TABLE product_work_norms DROP COLUMN IF EXISTS "class";
ALTER TABLE product_work_norms DROP COLUMN IF EXISTS "workCategoryId";
