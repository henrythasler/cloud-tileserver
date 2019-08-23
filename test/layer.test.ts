import { resolveLayerProperties, Layer } from "../src/index";
import { expect } from "chai";

import "jest";

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
                prefix: "DISTINCT ON(pop, name)"

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
            postfix: "ORDER BY pop DESC NULLS LAST",
            prefix: "DISTINCT ON(pop, name)"
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


