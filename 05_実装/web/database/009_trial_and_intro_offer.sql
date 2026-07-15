INSERT INTO products (id,code,name_key,seconds_granted,price_minor,currency,active,sort_order)
VALUES ('00000000-0000-4000-8000-000000000030','intro_30','product.intro',1800,500,'JPY',1,5)
ON DUPLICATE KEY UPDATE
  name_key=VALUES(name_key),
  seconds_granted=VALUES(seconds_granted),
  price_minor=VALUES(price_minor),
  currency=VALUES(currency),
  active=1,
  sort_order=VALUES(sort_order);
