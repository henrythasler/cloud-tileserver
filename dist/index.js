"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const aws_sdk_1 = require("aws-sdk");
const projection_1 = require("./projection");
const tileserver_1 = require("./tileserver");
const zlib_1 = require("zlib");
const sources_json_1 = __importDefault(require("./sources.json"));
const asyncgzip = util_1.promisify(zlib_1.gzip);
const cacheBucketName = "tiles.cyclemap.link";
const tileserver = new tileserver_1.Tileserver(sources_json_1.default, cacheBucketName);
const proj = new projection_1.Projection();
const log = new tileserver_1.Log();
exports.handler = async (event, context) => {
    /** This MUST be placed within this function for the module-tests (mock) to work correctly */
    const s3 = new aws_sdk_1.S3({ apiVersion: '2006-03-01' });
    let stats = {
        uncompressedBytes: 0,
        compressedBytes: 0
    };
    let response = {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/html',
            'access-control-allow-origin': '*',
            'Content-Encoding': 'identity'
        },
        body: "Error",
        isBase64Encoded: false
    };
    let tile = tileserver.extractTile(event.path);
    let source = tileserver.extractSource(event.path);
    if (tile && source) {
        let vectortile = null;
        let wgs84BoundingBox = proj.getWGS84TileBounds(tile);
        let query = tileserver.buildQuery(source, wgs84BoundingBox, tile.z);
        log.show(query, log.TRACE);
        /* istanbul ignore else: This can't happen due to implementation of buildQuery() */
        if (query) {
            try {
                let pgConfig = tileserver.getClientConfig(source);
                vectortile = await tileserver.fetchTileFromDatabase(query, pgConfig);
                stats.uncompressedBytes = vectortile.byteLength;
                vectortile = await asyncgzip(vectortile);
                stats.compressedBytes = vectortile.byteLength;
                let s3obj = await s3.putObject({
                    Body: vectortile,
                    Bucket: cacheBucketName,
                    Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentType: "application/vnd.mapbox-vector-tile",
                    ContentEncoding: "gzip",
                    CacheControl: "86400",
                }).promise();
                log.show(s3obj, log.DEBUG);
            }
            catch (error) {
                vectortile = null;
                response.body = JSON.stringify(error);
                log.show(error, log.ERROR);
            }
        }
        if (vectortile) {
            response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/vnd.mapbox-vector-tile',
                    'Content-Encoding': 'gzip',
                    'access-control-allow-origin': '*'
                },
                body: vectortile.toString('base64'),
                isBase64Encoded: true
            };
        }
        log.show(`${event.path} ${response.statusCode}: ${source}/${tile.z}/${tile.x}/${tile.y}  ${stats.uncompressedBytes} -> ${stats.compressedBytes}`, log.INFO);
    }
    return Promise.resolve(response);
};
