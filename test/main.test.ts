import { Projection, Tile, WGS84BoundingBox } from "../src/projection";
import { extractTile, extractSource, resolveLayerProperties, buildLayerQuery, SourceBasics, Layer } from "../src/index";
import { expect } from "chai";

import "jest";

let proj = new Projection();

describe("Parsing functions", function () {
    it("extractTile regular #1 - simple path", function () {
        let tile: Tile | null = extractTile("/local/0/0/0.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 0, "y": 0, "z": 0 });
    });
    it("extractTile regular #2 - complex path", function () {
        let tile: Tile | null = extractTile("/local/11/1087/714.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 1087, "y": 714, "z": 11 });
    });
    it("extractTile regular #3 - strange path", function () {
        let tile: Tile | null = extractTile("/local/1337/something/11/1087/714.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 1087, "y": 714, "z": 11 });
    });

    it("extractTile negative #1 - y-value missing", function () {
        let tile: Tile | null = extractTile("/local/1087/714.mvt");
        expect(tile).to.be.null;
    });
    it("extractTile negative #2 - wrong extension", function () {
        let tile: Tile | null = extractTile("/local/11/1087/714.pbf");
        expect(tile).to.be.null;
    });



    it("extractSource regular #1 - simple path", function () {
        let source: string | null = extractSource("/local/0/0/0.mvt");
        expect(source).to.be.equal('local');
    });
    it("extractSource regular #2 - strange path", function () {
        let source: string | null = extractSource("/foo/13bar37/global/11/1087/714.mvt/foo2/local/11/1087/714.mvt");
        expect(source).to.be.equal('local');
    });


    it("extractSource negative #1 - incomplete path", function () {
        let source: string | null = extractSource("/local/");
        expect(source).to.be.null;
    });

})


describe("resolveLayerProperties", function () {
    it("most simple case", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 11,
            }]
        }, 11);
        expect(resolved).to.deep.equal({
            name: "name",
            table: "table",
            minzoom: 11
        });
    });

    it("most simple case with all features", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 11,
                maxzoom: 12,
                table: "table_11",
                extend: 2048,
                buffer: 128,
                clip_geom: false,
                geom: "geom",
                srid: 3857,
                keys: ["osm_id", "name", "pop"],
                where: ["pop > 0", "name_de <> ''"],
                postfix: "ORDER BY pop DESC NULLS LAST",

            }]
        }, 11);
        expect(resolved).to.deep.equal({
            name: "name",
            table: "table_11",
            minzoom: 11,
            maxzoom: 12,
            extend: 2048,
            buffer: 128,
            clip_geom: false,
            geom: "geom",
            srid: 3857,
            keys: ["osm_id", "name", "pop"],
            where: ["pop > 0", "name_de <> ''"],
            postfix: "ORDER BY pop DESC NULLS LAST"
        });
    });

    it("two simple variants", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 10,
                table: "table_10"
            },
            {
                minzoom: 11,
                table: "table_11"
            }]
        }, 11);
        expect(resolved).to.deep.equal({
            name: "name",
            table: "table_11",
            minzoom: 11
        });
    });

    it("layer with maxzoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            maxzoom: 13,
            variants: [{
                minzoom: 10,
                table: "table_10"
            },
            {
                minzoom: 11,
                table: "table_11"
            }]
        }, 13);
        expect(resolved).to.be.null;
    });

    it("variants not applicable due to zoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 10,
                table: "table_10"
            },
            {
                minzoom: 11,
                table: "table_11"
            }]
        }, 9);
        expect(resolved).to.deep.equal({
            name: "name",
            table: "table"
        });
    });

    it("layer not applicable due to minzoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            minzoom: 9,
            name: "name",
            table: "table",
            variants: [{
                minzoom: 10,
                table: "table_10"
            },
            {
                minzoom: 11,
                table: "table_11"
            }]
        }, 8);
        expect(resolved).to.be.null;
    });

    it("variants not applicable due to zoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            minzoom: 9,
            name: "name",
            table: "table",
            variants: [{
                minzoom: 10,
                maxzoom: 12,
                table: "table_10"
            },
            {
                minzoom: 14,
                table: "table_11"
            }]
        }, 13);
        expect(resolved).to.deep.equal({
            minzoom: 9,
            name: "name",
            table: "table"
        });
    });
    it("variant with min- and max-zoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            minzoom: 9,
            name: "name",
            table: "table",
            variants: [{
                minzoom: 10,
                maxzoom: 12,
                table: "table_10"
            },
            {
                minzoom: 14,
                table: "table_11"
            }]
        }, 11);
        expect(resolved).to.deep.equal({
            minzoom: 10,
            maxzoom: 12,
            name: "name",
            table: "table_10"
        });
    });

    it("overwrite keys with variant", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            keys: ["one", "two"],
            srid: 3857,
            variants: [{
                minzoom: 10,
                table: "table_10",
                keys: ["three", "four"],
                srid: 4326,
            }]
        }, 10);
        expect(resolved).to.deep.equal({
            minzoom: 10,
            name: "name",
            table: "table_10",
            keys: ["three", "four"],
            srid: 4326
        });
    });

    it("delete keys in variant", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            keys: ["one", "two"],
            variants: [{
                minzoom: 10,
                table: "table_10",
                keys: [],
            }]
        }, 10);
        expect(resolved).to.deep.equal({
            minzoom: 10,
            name: "name",
            table: "table_10",
            keys: []
        });
    });    

    it("last variant match is used", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 11,
                table: "table_11",
            },
            {
                minzoom: 10,
                table: "table_10",
            }]
        }, 11);
        expect(resolved).to.deep.equal({
            minzoom: 10,
            name: "name",
            table: "table_10"
        });
    });

    it("consider maxzoom as less-than '<'", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            variants: [{
                minzoom: 11,
                table: "table_11",
            },
            {
                minzoom: 10,
                maxzoom: 11,
                table: "table_10",
            }]
        }, 11);
        expect(resolved).to.deep.equal({
            minzoom: 11,
            name: "name",
            table: "table_11"
        });
    });

    it("layer w/o any variants", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table"
        }, 11);
        expect(resolved).to.deep.equal({
            name: "name",
            table: "table"
        });
    });    

    it("layer w/o any variants gets rejected due to zoom", function () {
        let resolved: Layer | null = resolveLayerProperties({
            name: "name",
            table: "table",
            minzoom: 12
        }, 11);
        expect(resolved).to.be.null;
    });
})


describe("buildLayerQuery", function () {
    it("simple layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source"
        },
        {
            name: "layer1",
            table: "table1"
        },
        bbox,
        13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        256,
        true
        ) AS geom
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857))) as q)`);
    });

    it("simple layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source"
        },
        {
            name: "layer1",
            table: "table1",
            where: [],
            keys: []
        },
        bbox,
        13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        256,
        true
        ) AS geom
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857))) as q)`);
    });    

    it("full-featured layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source"
        },
        {
            name: "layer1",
            table: "table1",
            extend: 4096,
            buffer: 64,
            clip_geom: false,
            geom: "geometry",
            srid: 3857,
            keys: ["osm_id as id", "name"],
            where: ["TRUE"],
            minzoom: 10,
            postfix: "ORDER BY id"
        },
        bbox,
        13);
        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        64,
        false
        ) AS geom, osm_id as id, name
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)) AND (TRUE)ORDER BY id) as q)`);
    });    

    it("full-featured layer gets rejected due to minzoom", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source"
        },
        {
            name: "layer1",
            table: "table1",
            extend: 4096,
            buffer: 64,
            clip_geom: false,
            geom: "geometry",
            srid: 3857,
            keys: ["osm_id as id", "name"],
            where: ["TRUE"],
            minzoom: 10,
            postfix: "ORDER BY id"
        },
        bbox,
        9);
        expect(layerQuery).to.be.equal("");
    });

    it("layer with variant gets rejected due to minzoom", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source"
        },
        {
            name: "layer1",
            table: "table1",
            minzoom: 14,
            variants: [{
                minzoom: 15
            }]
        },
        bbox,
        8);
        expect(layerQuery).to.be.equal("");
    });      
    
    it("source-properties get propagated into layer", function () {
        let bbox: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        let layerQuery: string = buildLayerQuery({
            name: "source",
            geom: "geometry",
            extend: 4096,
            buffer: 64,
            clip_geom: false,
            srid: 3857,
            keys: ["osm_id as id", "name"],
            where: ["TRUE"],
            minzoom: 10,
            postfix: "ORDER BY id"
        },
        {
            name: "layer1",
            table: "table1",
        },
        bbox,
        10);

        expect(layerQuery).to.be.equal(`(SELECT ST_AsMVT(q, 'layer1', 4096, 'geom') as data FROM
    (SELECT ST_AsMvtGeom(
        geometry,
        ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857),
        4096,
        64,
        false
        ) AS geom, osm_id as id, name
    FROM table1 WHERE (geometry && ST_Transform(ST_MakeEnvelope(${bbox.leftbottom.lng}, ${bbox.leftbottom.lat}, ${bbox.righttop.lng}, ${bbox.righttop.lat}, 4326), 3857)) AND (TRUE)ORDER BY id) as q)`);
    });     
})