-- Created on first start of the docker compose database.
-- utf8mb4_0900_ai_ci is required: unique usernames and employee IDs rely on it ignoring letter case.
CREATE DATABASE IF NOT EXISTS selorax_team CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS teamprofile_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
