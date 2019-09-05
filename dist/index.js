"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tileserver_1 = require("./tileserver");
const sources_json_1 = __importDefault(require("./sources.json"));
const cacheBucketName = process.env.CACHE_BUCKET || "";
const logLevel = (process.env.LOG_LEVEL) ? parseInt(process.env.LOG_LEVEL) : undefined;
const tileserver = new tileserver_1.Tileserver(sources_json_1.default, cacheBucketName, logLevel);
exports.handler = async (event, context) => {
    let response;
    const vectortile = await tileserver.getVectortile(event.path);
    if ((vectortile.res >= 0) && (vectortile.data)) {
        response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'Content-Encoding': 'gzip',
                'access-control-allow-origin': '*'
            },
            body: vectortile.data.toString('base64'),
            isBase64Encoded: true
        };
    }
    else {
        response = {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*',
                'Content-Encoding': 'identity'
            },
            body: JSON.stringify(vectortile),
            isBase64Encoded: false
        };
    }
    return Promise.resolve(response);
};
