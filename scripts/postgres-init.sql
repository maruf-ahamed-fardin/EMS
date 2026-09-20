-- Runs once, when the compose Postgres volume is first created.
-- ems_test: wiped by the backend's database tests. ems_shadow: Prisma's scratch database for
-- `migrate dev` and the drift check.
CREATE DATABASE ems_test OWNER ems;
CREATE DATABASE ems_shadow OWNER ems;
