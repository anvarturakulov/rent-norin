-- Опциональные платёжные поля: NULL вместо 0, если не заполнены
ALTER TABLE docvalues ALTER COLUMN "cashFromPartner" DROP NOT NULL;
ALTER TABLE docvalues ALTER COLUMN currency DROP NOT NULL;
ALTER TABLE docvalues ALTER COLUMN usd DROP NOT NULL;
