import { Tile } from "../src/projection";
import { extractTile } from "../src/index";
import { expect } from "chai";

import "jest";

describe("Parsing functions", function () {
    it("extractTile #1", function () {
        let tile: Tile | null = extractTile("/local/0/0/0.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 0, "y": 0, "z": 0 });
    });
    it("extractTile #2", function () {
        let tile: Tile | null = extractTile("/local/11/1087/714.mvt");
        expect(tile).to.be.an('object');
        expect(tile).to.deep.equal({ "x": 1087, "y": 714, "z": 11 });
    });
})


