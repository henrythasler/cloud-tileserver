"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const projection_1 = require("./projection");
const proj = new projection_1.Projection();
exports.handler = async (event, context) => {
    let client = new pg_1.Client({
        statement_timeout: 120 * 1000
    });
    try {
        await client.connect();
        let tile = {
            x: parseInt(event.path.split("/")[4]),
            y: parseInt(event.path.split("/")[5].split(".")[0])
        };
        let zoom = parseInt(event.path.split("/")[3]);
        let bbox = proj.getWGS84TileBounds(tile, zoom);
        // console.log(bbox)
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
        let response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/vnd.mapbox-vector-tile',
                'access-control-allow-origin': '*'
            },
            body: vectortile.toString('base64'),
            isBase64Encoded: true
        };
        return Promise.resolve(response);
    }
    catch (error) {
        await client.end();
        console.log(error);
        return Promise.resolve({
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html',
                'access-control-allow-origin': '*'
            },
            body: JSON.stringify(error),
            isBase64Encoded: false
        });
    }
    // let response = JSON.stringify(event, null, 2);
    // return Promise.resolve(response)
};
