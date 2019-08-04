"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const projection_1 = require("./projection");
const s3_1 = __importDefault(require("aws-sdk/clients/s3"));
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
function extractLayer(path) {
    let layerCandidates = path.match(/(?!\/)\w+(?=\/\d)/);
    if (layerCandidates) {
        return layerCandidates[layerCandidates.length - 1];
    }
    return null;
}
async function fetchTileFromDatabase(bbox) {
    let client = new pg_1.Client();
    await client.connect();
    let res = await client.query(`SELECT ST_AsMVT(q, 'buildings', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, id
      FROM import.buildings
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`);
    let vectortile = res.rows[0].data;
    res = await client.query(`SELECT ST_AsMVT(q, 'landcover', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, osm_id as id, class, subclass, area, surface, name
      FROM import.landcover
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`);
    vectortile = Buffer.concat([vectortile, res.rows[0].data]);
    res = await client.query(`SELECT ST_AsMVT(q, 'roads', 4096, 'geom') as data FROM
(SELECT ST_AsMvtGeom(
          geometry,
          ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
          4096,
          256,
          true
        ) AS geom, osm_id as id, class, subclass, oneway, tracktype, bridge, tunnel, service, CASE WHEN layer IS NULL THEN 0 ELSE layer END as layer, rank, bicycle, scale, substring(ref from '\\w+') as ref_prefix, substring(ref from '\\d+') as ref_num, NULL as name
      FROM import.roads
      WHERE geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)
) as q`);
    vectortile = Buffer.concat([vectortile, res.rows[0].data]);
    await client.end();
    return vectortile;
}
exports.handler = async (event, context) => {
    let response = {
        statusCode: 500,
        headers: {
            'Content-Type': 'text/html',
            'access-control-allow-origin': '*'
        },
        body: "Error",
        isBase64Encoded: false
    };
    let tile = extractTile(event.path);
    let layer = extractLayer(event.path);
    if (tile && layer) {
        // let cacheObjects = await s3.listObjects({
        //     Bucket: cacheBucketName,
        //     Prefix: `${layer}/${tile.z}/${tile.x}/${tile.y}`
        // }).promise();
        let vectortile = null;
        // if (cacheObjects.Contents && cacheObjects.Contents.length > 0) {
        //     console.log(`${layer}/${tile.z}/${tile.x}/${tile.y} - cache hit`);
        //     let cacheobj = await s3.getObject({
        //         Bucket: cacheBucketName,
        //         Key: `${layer}/${tile.z}/${tile.x}/${tile.y}.mvt`
        //     }).promise();
        //     vectortile = <Buffer>cacheobj.Body;
        // }
        // else {
        console.log(`${layer}/${tile.z}/${tile.x}/${tile.y}`);
        let wgs84BoundingBox = proj.getWGS84TileBounds(tile);
        if (layer === "local") {
            try {
                vectortile = await fetchTileFromDatabase(wgs84BoundingBox);
                let s3obj = await s3.putObject({
                    Body: vectortile,
                    Bucket: cacheBucketName,
                    Key: `${layer}/${tile.z}/${tile.x}/${tile.y}.mvt`,
                    ContentEncoding: "application/vnd.mapbox-vector-tile"
                }).promise();
                // console.log(s3obj);
            }
            catch (error) {
                vectortile = null;
                console.log(error);
            }
        }
        // }
        if (vectortile) {
            response = {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/vnd.mapbox-vector-tile',
                    'access-control-allow-origin': '*'
                },
                body: vectortile.toString('base64'),
                isBase64Encoded: true
            };
        }
    }
    return Promise.resolve(response);
};
