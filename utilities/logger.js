const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logFormat = winston.format.printf(({
    level,
    message,
    label,
    timestamp
}) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = winston.createLogger({
    level: 'debug',
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            filename: 'logs/portale.log',
            frequency: '24h',
            datePattern: 'DD-MM-YYYY',
            zippedArchive: true,
            maxFiles: '14d'
        })
    ],
    format: winston.format.combine(
        winston.format.label({
            label: 'start.js'
        }),
        winston.format.timestamp(),
        logFormat),
    exitOnError: false
});

module.exports = logger;

