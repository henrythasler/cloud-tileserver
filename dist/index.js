"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
const pg_1 = require("pg");
const projection_1 = require("./projection");
const s3_1 = __importDefault(require("aws-sdk/clients/s3"));
const zlib_1 = require("zlib");
const layer_json_1 = __importDefault(require("./layer.json"));
const asyncgzip = util_1.promisify(zlib_1.gzip);
const config = layer_json_1.default;
// const config: Config = {sources: [{minzoom: 2, name:"434", layers:[{name:"eqw", table:"fdf", maxzoom: 2, variants:[{minzoom: 2}]}]}]};
const cacheBucketName = "tiles.cyclemap.link";
const proj = new projection_1.Projection();
const s3 = new s3_1.default({ apiVersion: '2006-03-01' });
function extractTile(path) {
    let tile = { x: 0, y: 0, z: 0 };
    let re = new RegExp(/\d+\/\d+\/\d+(?=.mvt)/g);
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
function extractSource(path) {
    let sourceCandidates = path.match(/(?!\/)\w+(?=\/\d)/);
    if (sourceCandidates) {
        return sourceCandidates[sourceCandidates.length - 1];
    }
    return null;
}
function resolveLayerProperties(layer, zoom) {
    let resolved = layer;
    /** check layer zoom if present */
    if ((layer.minzoom != undefined) && (zoom < layer.minzoom)) {
        console.log(`${zoom} < ${layer.minzoom}`);
        return undefined;
    }
    if ((layer.maxzoom != undefined) && (zoom >= layer.maxzoom)) {
        console.log(`${zoom} >= ${layer.minzoom}`);
        return undefined;
    }
    if (layer.variants && layer.variants.length) {
        for (let variant of layer.variants) {
            let variantMinzoom = (variant.minzoom != undefined) ? variant.minzoom : 0;
            let variantMaxzoom = (variant.maxzoom != undefined) ? variant.maxzoom : 32;
            if (zoom >= variantMinzoom && zoom < variantMaxzoom) {
                resolved = { ...layer, ...variant };
            }
        }
    }
    /** do not allow recursive definitions */
    delete resolved.variants;
    return resolved;
}
function replaceKeywords(source, layer, wgs84BoundingBox, zoom) {
    let resolved = layer;
    console.log(`${layer.name}:`);
    console.log(layer.variants);
    if (layer.variants && layer.variants.length) {
        resolved = resolveLayerProperties(layer, zoom);
        console.log(resolved);
    }
    if (resolved === undefined)
        return "";
    layer = { ...layer, ...resolved };
    let layerExtend = (layer.extend != undefined) ? layer.extend : ((source.extend != undefined) ? source.extend : 4096);
    let geom = (layer.geom != undefined) ? layer.geom : ((source.geom != undefined) ? source.geom : "geometry");
    let srid = (layer.srid != undefined) ? layer.srid : ((source.srid != undefined) ? source.srid : 3857);
    let bbox = `ST_Transform(ST_MakeEnvelope(${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}, 4326), ${srid})`;
    let buffer = (layer.buffer != undefined) ? layer.buffer : ((source.buffer != undefined) ? source.buffer : 256);
    let clip_geom = (layer.clip_geom != undefined) ? layer.clip_geom : ((source.clip_geom != undefined) ? source.clip_geom : true);
    let postfix = (layer.postfix != undefined) ? layer.postfix : ((source.postfix != undefined) ? source.postfix : "");
    let keys = "";
    if (source.keys && source.keys.length) {
        keys += ", " + source.keys.join(", ");
    }
    if (layer.keys && layer.keys.length) {
        keys += ", " + layer.keys.join(", ");
    }
    let where = "";
    if (source.where && source.where.length) {
        where += " AND (" + source.where.join(") AND (") + ")";
    }
    if (layer.where && layer.where.length) {
        where += " AND (" + layer.where.join(") AND (") + ")";
    }
    return (`(SELECT ST_AsMVT(q, '${layer.name}', ${layerExtend}, 'geom') as data FROM
        (SELECT ST_AsMvtGeom(
            ${geom},
            ${bbox},
            ${layerExtend},
            ${buffer},
            ${clip_geom}
            ) AS geom${keys}
        FROM ${layer.table} WHERE ${geom} && ${bbox}${where}${postfix}) as q)`);
}
function buildQuery(source, config, wgs84BoundingBox, zoom) {
    let query = null;
    let layerQueries = [];
    for (let sourceItem of config.sources) {
        if (sourceItem.name === source) {
            for (let layer of sourceItem.layers) {
                let layerQuery = replaceKeywords(sourceItem, layer, wgs84BoundingBox, zoom);
                if (layerQuery.length)
                    layerQueries.push(layerQuery);
            }
        }
    }
    if (layerQueries.length) {
        let layers = layerQueries.join(" || ");
        query = `SELECT ( ${layers} ) as data`;
    }
    else {
        query = `
        SELECT ( (SELECT ST_AsMVT(q, 'empty', 4096, 'geom') as data FROM
        (SELECT ST_AsMvtGeom(
            st_point(0,0),
            ST_MakeEnvelope(0, 1, 1, 0, 4326),
            4096,
            256,
            true
            ) AS geom ) as q) ) as data;        
        `;
    }
    // console.log(layerQueries);
    return query;
}
async function fetchTileFromDatabase(query) {
    let client = new pg_1.Client();
    await client.connect();
    let res = await client.query(query);
    //     let res: QueryResult = await client.query(`SELECT (
    //         SELECT ST_AsMVT(q, 'buildings', 4096, 'geom') as data FROM
    // (SELECT ST_AsMvtGeom(
    //           geometry,
    //           ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
    //           4096,
    //           256,
    //           true
    //         ) AS geom, id
    //       FROM import.buildings
    //       WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
    // ) as q)
    // ||
    // (SELECT ST_AsMVT(q, 'landcover', 4096, 'geom') as data FROM
    // (SELECT ST_AsMvtGeom(
    //           geometry,
    //           ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
    //           4096,
    //           256,
    //           true
    //         ) AS geom, osm_id as id, class, subclass, area, surface, name
    //       FROM import.landcover
    //       WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
    // ) as q)
    // ||
    // (SELECT ST_AsMVT(q, 'roads', 4096, 'geom') as data FROM
    // (SELECT ST_AsMvtGeom(
    //           geometry,
    //           ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
    //           4096,
    //           256,
    //           true
    //         ) AS geom, osm_id as id, class, subclass, oneway, tracktype, bridge, tunnel, service, CASE WHEN layer IS NULL THEN 0 ELSE layer END as layer, rank, bicycle, scale, substring(ref from '\\w+') as ref_prefix, substring(ref from '\\d+') as ref_num, NULL as name
    //       FROM import.roads
    //       WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
    // ) as q
    // ) as data
    // `)
    // let vectortile = Buffer.from(res.rows[0].data);
    await client.end();
    return res.rows[0].data;
}
exports.handler = async (event, context) => {
    let stats = {
        uncompressedBytes: 0,
        compressedBytes: 0
    };
    let response = {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/html',
            'access-control-allow-origin': '*',
            'Content-Encoding': 'identity',
        },
        body: "Error",
        isBase64Encoded: false
    };
    let tile = extractTile(event.path);
    let source = extractSource(event.path);
    if (tile && source) {
        let vectortile = null;
        let wgs84BoundingBox = proj.getWGS84TileBounds(tile);
        let query = buildQuery(source, config, wgs84BoundingBox, tile.z);
        console.log(query);
        if (query) {
            try {
                vectortile = await fetchTileFromDatabase(query);
                stats.uncompressedBytes = vectortile.byteLength;
                vectortile = await asyncgzip(vectortile);
                stats.compressedBytes = vectortile.byteLength;
                let s3obj = await s3.putObject({
                    Body: vectortile,
                    Bucket: cacheBucketName,
                    Key: `${source}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentType: "application/vnd.mapbox-vector-tile",
                    ContentEncoding: "gzip",
                    Metadata: {
                        "wgs84BoundingBox": `${wgs84BoundingBox.leftbottom.lng}, ${wgs84BoundingBox.leftbottom.lat}, ${wgs84BoundingBox.righttop.lng}, ${wgs84BoundingBox.righttop.lat}`
                    }
                }).promise();
                // console.log(s3obj);
            }
            catch (error) {
                vectortile = null;
                console.log(error);
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
        console.log(`${response.statusCode}: ${source}/${tile.z}/${tile.x}/${tile.y}  ${stats.uncompressedBytes} -> ${stats.compressedBytes}`);
    }
    return Promise.resolve(response);
};
