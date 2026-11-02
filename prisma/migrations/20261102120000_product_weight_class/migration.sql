-- Website weight class for return + no-lift floor pricing. Additive only:
-- nullable columns, no default (a product without one counts as LIGHT).
CREATE TYPE "WeightClass" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

ALTER TABLE "Product" ADD COLUMN "weightClass" "WeightClass";

ALTER TABLE "ProductOption" ADD COLUMN "weightClass" "WeightClass";
