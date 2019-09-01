"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const zlib_1 = require("zlib");
const aws_sdk_1 = require("aws-sdk");
const pg_1 = require("pg");
const projection_1 = require("./projection");
const asyncgzip = util_1.promisify(zlib_1.gzip);
var LogLevels;
(function (LogLevels) {
    LogLevels[LogLevels["SILENT"] = 1] = "SILENT";
    LogLevels[LogLevels["ERROR"] = 2] = "ERROR";
    LogLevels[LogLevels["INFO"] = 3] = "INFO";
    LogLevels[LogLevels["DEBUG"] = 4] = "DEBUG";
    LogLevels[LogLevels["TRACE"] = 5] = "TRACE";
})(LogLevels = exports.LogLevels || (exports.LogLevels = {}));
;
/**
 * Wrapper for Debug-Outputs to console
 * @param msg object to log
 * @param level log-level
 */
class Log {
    constructor(level) {
        this.loglevel = LogLevels.ERROR;
        this.loglevel = (level) ? level : LogLevels.DEBUG;
    }
    show(msg, level) {
        if (level <= this.loglevel)
            console.log(msg);
    }
}
exports.Log = Log;
class Tileserver {
    /**
     * @constructor
     * @param config
     * @param cacheBucketName
     */
    constructor(config, cacheBucketName, logLevel = LogLevels.ERROR, gzip = true) {
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
    extractTile(path) {
        let tile = { x: 0, y: 0, z: 0 };
        let re = new RegExp(/\d+\/\d+\/\d+(?=\.mvt\b)/g);
        let tilepath = path.match(re);
        if (tilepath) {
            let numbers = tilepath[0].split("/");
            tile.y = parseInt(numbers[numbers.length - 1]);
            tile.x = parseInt(numbers[numbers.length - 2]);
            tile.z = parseInt(numbers[numbers.length - 3]);
            return tile;
        }
        return null;
    }
    /**
     * Extracts the layer-name from a given path.
     * @param path a full path including arbitrary prefix-path, layer, tile and extension
     * @return the name of the source if found
     */
    extractSource(path) {
        // match the last word between slashes before the actual tile (3-numbers + extension)
        let sourceCandidates = path.match(/(?!\/)\w+(?=\/\d+\/\d+\/\d+\.mvt\b)/g);
        if (sourceCandidates != null && sourceCandidates.length > 0) {
            return sourceCandidates[sourceCandidates.length - 1];
        }
        return null;
    }
    /**
     * Check a given layer and variants against the zoom-level. Merge the **last** matching item in the variant-array into the layer and return it.
     * Matching the **last** variant item makes the variant-objects shorter as we don't need to give a maxzoom but use a sequence of minzooms for each variant.
     * @param layer This is the input layer including variants
     * @param zoom The zoom-level to check the layer incl. variants against
     * @return The resulting layer where the **last** matching variant is merged into the layer or null if zoom is out of bounds
     */
    resolveLayerProperties(layer, zoom) {
        let resolved = { ...layer };
        /** check layer zoom if present */
        if (((layer.minzoom != undefined) && (zoom < layer.minzoom)) ||
            ((layer.maxzoom != undefined) && (zoom >= layer.maxzoom))) {
            return null;
        }
        if (layer.variants && layer.variants.length) {
            for (let variant of layer.variants) {
                /** the default zoom-values should cover all use-cases on earth */
                let variantMinzoom = (variant.minzoom != undefined) ? variant.minzoom : /* istanbul ignore next: This can't happen due to interface definition */ 0;
                let variantMaxzoom = (variant.maxzoom != undefined) ? variant.maxzoom : 32;
                if (zoom >= variantMinzoom && zoom < variantMaxzoom) {
                    /** We have a match: merge the variant with the original layer. */
                    resolved = { ...layer, ...variant };
                }
            }
        }
        /** do not allow recursive definitions */
        delete resolved.variants;
        return resolved;
    }
    /**
     * This will create the SQL-Query for a given layer. Source-specific properties (if given) will be used
     * if not defined for the layer.
     * @param source This is the source object. It can also be a simplified Source-Object w/o
     * the layer information as it's not needed here (used for simplified unit-tests)).
     * @param layer The layer that we need the SQL-Query for. Can include variants.
     * @param wgs84BoundingBox The boundingbox for the tile
     * @param zoom Zoom level
     */
    buildLayerQuery(source, layer, wgs84BoundingBox, zoom) {
        let resolved = this.resolveLayerProperties(layer, zoom);
        // Layer is empty due to zoom constrains. No further processing needed.
        if (resolved === null)
            return null;
        // FIXME: minzoom and maxzoom must be propagated from source into layer
        let layerExtend = (resolved.extend != undefined) ? resolved.extend : ((source.extend != undefined) ? source.extend : 4096);
        let sql = (resolved.sql != undefined) ? resolved.sql : ((source.sql != undefined) ? source.sql : "");
        let geom = (resolved.geom != undefined) ? resolved.geom : ((source.geom != undefined) ? source.geom : "geometry");
        let srid = (resolved.srid != undefined) ? resolved.srid : ((source.srid != undefined) ? source.srid : 3857);
        let bbox = `ST_Transform(ST_MakeEnvelope(${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}, 4326), ${srid})`;
        let buffer = (resolved.buffer != undefined) ? resolved.buffer : ((source.buffer != undefined) ? source.buffer : 256);
        let clip_geom = (resolved.clip_geom != undefined) ? resolved.clip_geom : ((source.clip_geom != undefined) ? source.clip_geom : true);
        let prefix = (resolved.prefix != undefined) ? resolved.prefix : ((source.prefix != undefined) ? source.prefix : "");
        let postfix = (resolved.postfix != undefined) ? resolved.postfix : ((source.postfix != undefined) ? source.postfix : "");
        let keys = "";
        if (source.keys && source.keys.length) {
            keys += ", " + source.keys.join(", ");
        }
        if (resolved.keys && resolved.keys.length) {
            keys += ", " + resolved.keys.join(", ");
        }
        let where = "";
        if (source.where && source.where.length) {
            where += " AND (" + source.where.join(") AND (") + ")";
        }
        if (resolved.where && resolved.where.length) {
            where += " AND (" + resolved.where.join(") AND (") + ")";
        }
        if (sql) {
            return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') AS l FROM
        (${sql}) AS q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/!BBOX!/g, `${bbox}`).replace(/\s+/g, ' ');
        }
        else {
            return `(SELECT ST_AsMVT(q, '${resolved.name}', ${layerExtend}, 'geom') AS l FROM
        (SELECT ${prefix}ST_AsMvtGeom(
            ${geom},
            ${bbox},
            ${layerExtend},
            ${buffer},
            ${clip_geom}
            ) AS geom${keys}
        FROM ${resolved.table} WHERE (${geom} && ${bbox})${where}${postfix}) AS q)`.replace(/!ZOOM!/g, `${zoom}`).replace(/\s+/g, ' ');
        }
    }
    /**
     * Resolves, assembles and merges all layers-queries.
     * @param source This is the source object as per ClientConfig
     * @param wgs84BoundingBox The boundingbox for the tile
     * @param zoom Zoom level
     */
    buildQuery(source, wgs84BoundingBox, zoom) {
        let query = null;
        let layerQueries = [];
        let layerNames = [];
        for (let sourceItem of this.config.sources) {
            if (sourceItem.name === source) {
                for (let layer of sourceItem.layers) {
                    /** Accoring to https://github.com/mapbox/vector-tile-spec/tree/master/2.1#41-layers:
                     *    Prior to appending a layer to an existing Vector Tile, an encoder MUST check the existing name fields in order to prevent duplication.
                     *  implementation solution: ignore subsequent duplicates and log an error*/
                    if (!layerNames.includes(layer.name)) {
                        layerNames.push(layer.name);
                        let layerQuery = this.buildLayerQuery(sourceItem, layer, wgs84BoundingBox, zoom);
                        if (layerQuery)
                            layerQueries.push(layerQuery);
                    }
                    else {
                        this.log.show(`ERROR - Duplicate layer name: ${layer.name}`, LogLevels.ERROR);
                    }
                }
            }
        }
        /** merge all queries with the string concatenation operator */
        if (layerQueries.length) {
            let layers = layerQueries.join(" || ");
            query = `SELECT ( ${layers} ) AS mvt`;
        }
        else {
            query = "";
            // FIXME: Do we really have to create an empty tile?
            //     query = `SELECT ( (SELECT ST_AsMVT(q, 'empty', 4096, 'geom') AS l FROM
            // (SELECT ST_AsMvtGeom(
            //     ST_GeomFromText('POLYGON EMPTY'),
            //     ST_MakeEnvelope(0, 1, 1, 0, 4326),
            //     4096,
            //     256,
            //     true
            //     ) AS geom ) AS q) ) AS d;`;
        }
        return query.replace(/\s+/g, ' ');
    }
    async fetchTileFromDatabase(query, clientConfig) {
        let client = new pg_1.Client(clientConfig);
        await client.connect();
        let res = await client.query(query);
        this.log.show(res.rows[0], LogLevels.TRACE);
        await client.end();
        if (res.rows[0].mvt)
            return res.rows[0].mvt; // the .d property is taken from the outer AS-alias of the query
        else
            throw new Error("Property 'mvt' does not exist in res.rows[0]");
    }
    getClientConfig(source) {
        let clientConfig = {};
        for (let sourceItem of this.config.sources) {
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
    }
    /**
     * The main function that returns a vectortile in mvt-format.
     * @param path a full path including arbitrary prefix-path, layer, tile and extension
     */
    async getVectortile(path) {
        let mvt = { res: 0 };
        const s3 = new aws_sdk_1.S3({ apiVersion: '2006-03-01' });
        let tile = this.extractTile(path);
        if (tile) {
            let source = this.extractSource(path);
            if (source) {
                let wgs84BoundingBox = this.proj.getWGS84TileBounds(tile);
                let query = this.buildQuery(source, wgs84BoundingBox, tile.z);
                this.log.show(query, LogLevels.DEBUG);
                let data = null;
                if (query) {
                    let pgConfig = this.getClientConfig(source);
                    this.log.show(pgConfig, LogLevels.TRACE);
                    try {
                        data = await this.fetchTileFromDatabase(query, pgConfig);
                    }
                    catch (error) {
                        mvt.res = -4;
                        mvt.status = `[ERROR] - Database error: ${error.message}`;
                        this.log.show(error, LogLevels.DEBUG);
                    }
                }
                else {
                    mvt.res = 1; // Empty query => empty tile
                    mvt.status = `[INFO] - Empty query for '${path}'`;
                    data = Buffer.from("");
                }
                this.log.show(data, LogLevels.TRACE);
                if (data) {
                    let uncompressedBytes = data.byteLength;
                    if (this.gzip)
                        mvt.data = await asyncgzip(data);
                    else
                        mvt.data = data;
                    let compressedBytes = mvt.data.byteLength;
                    this.log.show(`${path} ${source}/${tile.z}/${tile.x}/${tile.y}  ${uncompressedBytes} -> ${compressedBytes}`, LogLevels.INFO);
                    if (this.cacheBucketName) {
                        try {
                            await s3.putObject({
                                Body: mvt.data,
                                Bucket: this.cacheBucketName,
                                Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                                ContentType: "application/vnd.mapbox-vector-tile",
                                ContentEncoding: (this.gzip) ? "gzip" : "identity",
                                CacheControl: "604800",
                            }).promise();
                        }
                        catch (error) {
                            mvt.res = 2;
                            mvt.status = `[INFO] - Could not put to S3: ${error.message}`;
                            this.log.show(error, LogLevels.DEBUG);
                        }
                    }
                }
            }
            else {
                mvt.res = -3;
                mvt.status = `[ERROR] - Source not correctly specified in '${path}'`;
            }
        }
        else {
            mvt.res = -2;
            mvt.status = `[ERROR] - Tile not correctly specified in '${path}'`;
        }
        return mvt;
    }
}
exports.Tileserver = Tileserver;
