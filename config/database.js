require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Kalki@123",
    database: process.env.DB_NAME || "Kalki",
    host: process.env.DB_HOST || "3.107.228.93",
    dialect: "postgres",
    logging: console.log
  },
  production: {
    username: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "Kalki@123",
    database: process.env.DB_NAME || "Kalki",
    host: process.env.DB_HOST || "3.107.228.93",
    dialect: "postgres",
    logging: false
  }
};
