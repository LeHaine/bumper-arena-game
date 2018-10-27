const winston = require("winston");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.prettyPrint()
    ),
    transports: [
        new winston.transports.Console({ format: winston.format.simple() })
        // new winston.transports.File({ filename: "error.log", level: "error" }),
        // new winston.transports.File({ filename: "combined.log" })
    ]
});

if (process.env.NODE_ENV !== "production") {
    logger.level = "debug";
}

module.exports = logger;
