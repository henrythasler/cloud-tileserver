"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var util_1 = require("util");
var zlib_1 = require("zlib");
var aws_sdk_1 = require("aws-sdk");
var pg_1 = require("pg");
var projection_1 = require("./projection");
var asyncgzip = util_1.promisify(zlib_1.gzip);
var LogLevels;
(function (LogLevels) {
    LogLevels[LogLevels["SILENT"] = 1] = "SILENT";
    LogLevels[LogLevels["ERROR"] = 2] = "ERROR";
    LogLevels[LogLevels["INFO"] = 3] = "INFO";
    LogLevels[LogLevels["DEBUG"] = 4] = "DEBUG";
    LogLevels[LogLevels["TRACE"] = 5] = "TRACE";
})(LogLevels = exports.LogLevels || (exports.LogLevels = {}));
/**
 * Wrapper for Debug-Outputs to console
 * @param msg object to log
 * @param level log-level
 */
var Log = /** @class */ (function () {
    function Log(level) {
        this.loglevel = (level) ? level : LogLevels.DEBUG;
    }
    Log.prototype.show = function (msg, level) {
        if (level <= this.loglevel)
            console.log(msg);
    };
    return Log;
}());
exports.Log = Log;
var Tileserver = /** @class */ (function () {
    /**
     * @constructor
     * @param config
     * @param cacheBucketName
     */
    function Tileserver(config, cacheBucketName, logLevel, gzip) {
        if (logLevel === void 0) { logLevel = LogLevels.ERROR; }
        if (gzip === void 0) { gzip = true; }
        this.cacheBucketName = null;
        this.proj = new projection_1.Projection();
        if (cacheBucketName)
            this.cacheBucketName = cacheBucketName;
        this.config = config;
        this.gzip = gzip;
        this.log = new Log(logLevel);
    }
    /**
     * Extract zxy-tile information from a given path. Also checks for a valid file-extension.
     * @param path a full path including arbitrary prefix-path, layer, tile and extension
     * @return a tile for subsequent use or null if no valid Tile could be extracted.
     */
    Tileserver.prototype.extractTile = function (path) {
        var tile = { x: 0, y: 0, z: 0 };
        var tilepath = path.match(/\d+\/\d+\/\d+(?=\.mvt\b)/g);
        if (tilepath) {
            var numbers = tilepath[0].split("/");
            tile.y = parseInt(numbers[numbers.length - 1]);
            tile.x = parseInt(numbers[numbers.length - 2]);
            tile.z = parseInt(numbers[numbers.length - 3]);
            return tile;
        }
        return null;
    };
    /**
     * Extracts the layer-name from a given path.
     * @param path a full path including arbitrary prefix-path, layer, tile and extension
     * @return the name of the source if found
     */
    Tileserver.prototype.extractSource = function (path) {
        // match the last word between slashes before the actual tile (3-numbers + extension)
        var sourceCandidates = path.match(/(?!\/)\w+(?=\/\d+\/\d+\/\d+\.mvt\b)/g);
        if (sourceCandidates != null && sourceCandidates.length > 0) {
            return sourceCandidates[sourceCandidates.length - 1];
        }
        return null;
    };
    /**
     * Check a given layer and variants against the zoom-level. Merge the **last** matching item in the variant-array into the layer and return it.
     * Matching the **last** variant item makes the variant-objects shorter as we don't need to give a maxzoom but use a sequence of minzooms for each variant.
     * @param layer This is the input layer including variants
     * @param zoom The zoom-level to check the layer incl. variants against
     * @return The resulting layer where the **last** matching variant is merged into the layer or null if zoom is out of bounds
     */
    Tileserver.prototype.resolveLayerProperties = function (layer, zoom) {
        var resolved = __assign({}, layer);
        /** check layer zoom if present */
        if (((layer.minzoom !== undefined) && (zoom < layer.minzoom)) ||
            ((layer.maxzoom !== undefined) && (zoom >= layer.maxzoom))) {
            return null;
        }
        if (layer.variants && layer.variants.length) {
            for (var _i = 0, _a = layer.variants; _i < _a.length; _i++) {
                var variant = _a[_i];
                /** the default zoom-values should cover all use-cases on earth */
                var variantMinzoom = (variant.minzoom !== undefined) ? variant.minzoom : /* istanbul ignore next: This can't happen due to interface definition */ 0;
                var variantMaxzoom = (variant.maxzoom !== undefined) ? variant.maxzoom : 32;
                if (zoom >= variantMinzoom && zoom < variantMaxzoom) {
                    /** We have a match: merge the variant with the original layer. */
                    resolved = __assign({}, layer, variant);
                }
            }
        }
        /** do not allow recursive definitions */
        delete resolved.variants;
        return resolved;
    };
    /**
     * This will create the SQL-Query for a given layer. Source-specific properties (if given) will be used
     * if not defined for the layer.
     * @param source This is the source object. It can also be a simplified Source-Object w/o
     * the layer information as it's not needed here (used for simplified unit-tests)).
     * @param layer The layer that we need the SQL-Query for. Can include variants.
     * @param wgs84BoundingBox The boundingbox for the tile
     * @param zoom Zoom level
     * @return the resulting query for this layer if applicable
     */
    Tileserver.prototype.buildLayerQuery = function (source, layer, wgs84BoundingBox, zoom) {
        var resolved = this.resolveLayerProperties(layer, zoom);
        // Layer is empty due to zoom constrains. No further processing needed.
        if (resolved === null)
            return null;
        // FIXME: minzoom and maxzoom must be propagated from source into layer
        var layerExtend = (resolved.extend !== undefined) ? resolved.extend : ((source.extend !== undefined) ? source.extend : 4096);
        var sql = (resolved.sql !== undefined) ? resolved.sql : ((source.sql !== undefined) ? source.sql : "");
        var geom = (resolved.geom !== undefined) ? resolved.geom : ((source.geom !== undefined) ? source.geom : "geometry");
        var srid = (resolved.srid !== undefined) ? resolved.srid : ((source.srid !== undefined) ? source.srid : 3857);
        var bbox = "ST_Transform(ST_MakeEnvelope(" + wgs84BoundingBox.leftbottom.lng + ", " + wgs84BoundingBox.leftbottom.lat + ", \n            " + wgs84BoundingBox.righttop.lng + ", " + wgs84BoundingBox.righttop.lat + ", 4326), " + srid + ")";
        var buffer = (resolved.buffer !== undefined) ? resolved.buffer : ((source.buffer !== undefined) ? source.buffer : 64);
        var clip_geom = (resolved.clip_geom !== undefined) ? resolved.clip_geom : ((source.clip_geom !== undefined) ? source.clip_geom : true);
        var prefix = (resolved.prefix !== undefined) ? resolved.prefix : ((source.prefix !== undefined) ? source.prefix : "");
        var postfix = (resolved.postfix !== undefined) ? resolved.postfix : ((source.postfix !== undefined) ? source.postfix : "");
        var namespace = (resolved.namespace !== undefined) ? resolved.namespace + "." : ((source.namespace !== undefined) ? source.namespace + "." : "");
        var keys = "";
        if (source.keys && source.keys.length) {
            keys += ", " + source.keys.join(", ");
        }
        if (resolved.keys && resolved.keys.length) {
            keys += ", " + resolved.keys.join(", ");
        }
        var where = "";
        if (source.where && source.where.length) {
            where += " AND (" + source.where.join(") AND (") + ")";
        }
        if (resolved.where && resolved.where.length) {
            where += " AND (" + resolved.where.join(") AND (") + ")";
        }
        if (sql) {
            return ("(SELECT ST_AsMVT(q, '" + resolved.name + "', " + layerExtend + ", 'geom') AS l FROM\n        (" + sql + ") AS q)").replace(/!ZOOM!/g, "" + zoom).replace(/!BBOX!/g, "" + bbox).replace(/\s+/g, ' ');
        }
        else {
            return ("(SELECT ST_AsMVT(q, '" + resolved.name + "', " + layerExtend + ", 'geom') AS l FROM\n        (SELECT " + prefix + "ST_AsMvtGeom(\n            " + geom + ",\n            " + bbox + ",\n            " + layerExtend + ",\n            " + buffer + ",\n            " + clip_geom + "\n            ) AS geom" + keys + "\n        FROM " + namespace + resolved.table + " WHERE (" + geom + " && " + bbox + ")" + where + postfix + ") AS q)").replace(/!ZOOM!/g, "" + zoom).replace(/\s+/g, ' ');
        }
    };
    /**
     * Resolves, assembles and merges all layers-queries.
     * @param source This is the source object as per ClientConfig
     * @param wgs84BoundingBox The boundingbox for the tile
     * @param zoom Zoom level
     * @return the resulting query for the source if applicable
     */
    Tileserver.prototype.buildQuery = function (source, wgs84BoundingBox, zoom) {
        var query = "";
        var layerQueries = [];
        var layerNames = [];
        for (var _i = 0, _a = this.config.sources; _i < _a.length; _i++) {
            var sourceItem = _a[_i];
            if (sourceItem.name === source) {
                for (var _b = 0, _c = sourceItem.layers; _b < _c.length; _b++) {
                    var layer = _c[_b];
                    /** Accoring to https://github.com/mapbox/vector-tile-spec/tree/master/2.1#41-layers:
                     *    Prior to appending a layer to an existing Vector Tile, an encoder MUST check the existing name fields in order to prevent duplication.
                     *  implementation solution: ignore subsequent duplicates and log an error*/
                    if (!layerNames.includes(layer.name)) {
                        layerNames.push(layer.name);
                        var layerQuery = this.buildLayerQuery(sourceItem, layer, wgs84BoundingBox, zoom);
                        if (layerQuery)
                            layerQueries.push(layerQuery);
                    }
                    else {
                        this.log.show("ERROR - Duplicate layer name: " + layer.name, LogLevels.ERROR);
                    }
                }
            }
        }
        /** merge all layer-queries with the postgres string concatenation operator (https://www.postgresql.org/docs/9.1/functions-string.html)*/
        if (layerQueries.length) {
            var layers = layerQueries.join(" || ");
            query = "SELECT ( " + layers + " ) AS mvt";
        }
        // remove whitespaces and newlines from resulting query
        return query.replace(/\s+/g, ' ');
    };
    /**
     * All database interaction is encapsulated in this function. The design-goal is to keep the time where a database-
     * connection is open to a minimum. This reduces the risk for the database-instance to run out of connections.
     * @param query the actual query to be sent to the database engine
     * @param clientConfig a pg-config-Object. see https://node-postgres.com/api/client#constructor
     * @return the vectortile-data as Buffer wrapped in a promise.
     */
    Tileserver.prototype.fetchTileFromDatabase = function (query, clientConfig) {
        return __awaiter(this, void 0, void 0, function () {
            var client, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        client = new pg_1.Client(clientConfig);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, client.query(query)];
                    case 2:
                        res = _a.sent();
                        this.log.show(res.rows[0], LogLevels.TRACE);
                        return [4 /*yield*/, client.end()];
                    case 3:
                        _a.sent();
                        if (res.rows[0].mvt) {
                            return [2 /*return*/, res.rows[0].mvt]; // the .mvt property is taken from the outer AS-alias of the query (see buildQuery())
                        }
                        else {
                            throw new Error("Property 'mvt' does not exist in res.rows[0]");
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Checks the source-config in `./sources.json` and builds a pg-config-object from properties defined for each source-item
     * @param source the source to create a config for
     * @return a pg-config-Object. see https://node-postgres.com/api/client#constructor
     */
    Tileserver.prototype.getClientConfig = function (source) {
        var clientConfig = {};
        for (var _i = 0, _a = this.config.sources; _i < _a.length; _i++) {
            var sourceItem = _a[_i];
            if (sourceItem.name === source) {
                // pick only the connection info from the sourceItem
                if ("host" in sourceItem)
                    clientConfig.host = sourceItem.host;
                if ("port" in sourceItem)
                    clientConfig.port = sourceItem.port;
                if ("user" in sourceItem)
                    clientConfig.user = sourceItem.user;
                if ("password" in sourceItem)
                    clientConfig.password = sourceItem.password;
                if ("database" in sourceItem)
                    clientConfig.database = sourceItem.database;
            }
        }
        return clientConfig;
    };
    /**
     * The main function that returns a vectortile in mvt-format.
     * @param path a full path including arbitrary prefix, source, tile and extension `/{SOURCE}/{Z}/{X}/{Y}.mvt`
     * @return contains the vectortile-data and some meta-information
     */
    Tileserver.prototype.getVectortile = function (path) {
        return __awaiter(this, void 0, void 0, function () {
            var mvt, s3, tile, msg, source, msg, wgs84BoundingBox, query, data, pgConfig, error_1, msg, uncompressedBytes, _a, compressedBytes, error_2, msg;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        mvt = { res: 0 };
                        s3 = new aws_sdk_1.S3({ apiVersion: '2006-03-01' });
                        tile = this.extractTile(path);
                        if (!tile) {
                            msg = "[ERROR] - Tile not correctly specified in '" + path + "'";
                            this.log.show(msg, LogLevels.ERROR);
                            mvt.res = -2;
                            mvt.status = msg;
                            return [2 /*return*/, mvt];
                        }
                        source = this.extractSource(path);
                        if (!source) {
                            msg = "[ERROR] - Source not correctly specified in '" + path + "'";
                            this.log.show(msg, LogLevels.ERROR);
                            mvt.res = -3;
                            mvt.status = msg;
                            return [2 /*return*/, mvt];
                        }
                        wgs84BoundingBox = this.proj.getWGS84TileBounds(tile);
                        query = this.buildQuery(source, wgs84BoundingBox, tile.z);
                        this.log.show(query, LogLevels.DEBUG);
                        data = null;
                        if (!query) return [3 /*break*/, 5];
                        pgConfig = this.getClientConfig(source);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, this.fetchTileFromDatabase(query, pgConfig)];
                    case 2:
                        data = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _b.sent();
                        mvt.res = -4;
                        mvt.status = "[ERROR] - Database error: " + error_1.message;
                        this.log.show(error_1, LogLevels.ERROR);
                        return [2 /*return*/, mvt];
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        msg = "[INFO] - Empty query for '" + path + "'";
                        this.log.show(msg, LogLevels.INFO);
                        mvt.res = 1;
                        mvt.status = msg;
                        data = Buffer.from("");
                        _b.label = 6;
                    case 6:
                        this.log.show(data, LogLevels.TRACE);
                        uncompressedBytes = data.byteLength;
                        if (!this.gzip) return [3 /*break*/, 8];
                        _a = mvt;
                        return [4 /*yield*/, asyncgzip(data)];
                    case 7:
                        _a.data = (_b.sent());
                        return [3 /*break*/, 9];
                    case 8:
                        mvt.data = data;
                        _b.label = 9;
                    case 9:
                        compressedBytes = mvt.data.byteLength;
                        // log some stats about the generated tile
                        this.log.show(path + " " + source + "/" + tile.z + "/" + tile.x + "/" + tile.y + "  " + uncompressedBytes + " -> " + compressedBytes, LogLevels.INFO);
                        if (!this.cacheBucketName) return [3 /*break*/, 14];
                        _b.label = 10;
                    case 10:
                        _b.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, s3.putObject({
                                Body: mvt.data,
                                Bucket: this.cacheBucketName,
                                Key: source + "/" + tile.z + "/" + tile.x + "/" + tile.y + ".mvt",
                                ContentType: "application/vnd.mapbox-vector-tile",
                                ContentEncoding: (this.gzip) ? "gzip" : "identity",
                                CacheControl: "max-age=220752000"
                            }).promise()];
                    case 11:
                        _b.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        error_2 = _b.sent();
                        msg = "[ERROR] - Could not putObject() to S3: " + error_2.message;
                        mvt.res = 2;
                        mvt.status = msg;
                        this.log.show(msg, LogLevels.ERROR);
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        this.log.show("[INFO] - env.CACHE_BUCKET not defined. Caching to S3 disabled.", LogLevels.INFO);
                        _b.label = 15;
                    case 15: return [2 /*return*/, mvt];
                }
            });
        });
    };
    return Tileserver;
}());
exports.Tileserver = Tileserver;
