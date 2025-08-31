import { Projection, Wgs84, Mercator, MercatorBoundingBox, WGS84BoundingBox, Tile, TileList } from "../src/projection";

import "jest";

let proj = new Projection();

function expectCloseTo(specimen: number, fixture: number, eps: number = 1e-6): void {
    expect(Math.abs(specimen - fixture)).toBeLessThanOrEqual(eps);
}

describe("Coordinate Transformation Tests", function () {
    it("getWGS84FromMercator with zeros", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: 0, y: 0 });
        expect(pos).toEqual({ "lng": 0, "lat": 0 });
    });

    it("getWGS84FromMercator with positive values", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: 1252344, y: 6105178 });
        expect(pos).toHaveProperty("lng");
        expect(pos).toHaveProperty("lat");
        expectCloseTo(pos.lng, 11.249999999999993, 0.00001);
        expectCloseTo(pos.lat, 47.989921667414194, 0.00001);
    });

    it("getWGS84FromMercator with negative values", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: -7604567, y: -7330617 });
        expect(pos).toHaveProperty("lng");
        expect(pos).toHaveProperty("lat");
        expectCloseTo(pos.lng, -68.31298828125001, 0.00001);
        expectCloseTo(pos.lat, -54.838663612975104, 0.00001);
    });

    it("getWGS84FromMercator projected bounds", function () {
        let pos: Wgs84 = proj.getWGS84FromMercator({ x: -20037508.342789, y: 20037508.342789 });
        expect(pos).toHaveProperty("lng");
        expect(pos).toHaveProperty("lat");
        expectCloseTo(pos.lng, -180, 0.00001);
        expectCloseTo(pos.lat, 85.051129, 0.00001);
    });

    it("getMercatorFromPixels at Null-Island", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 256, y: 256 }, 1);
        expect(pos).toHaveProperty("x");
        expect(pos).toHaveProperty("y");
        expectCloseTo(pos.x, 0, 0.00001);
        expectCloseTo(pos.y, 0, 0.00001);
    });

    it("getMercatorFromPixels #1", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 0, y: 0 }, 1);
        expect(pos).toHaveProperty("x");
        expect(pos).toHaveProperty("y");
        expectCloseTo(pos.x, -20037508.342789, 0.00001);
        expectCloseTo(pos.y, 20037508.342789, 0.00001);
    });

    it("getMercatorFromPixels #2", function () {
        let pos: Mercator = proj.getMercatorFromPixels({ x: 1301248, y: 2864384 }, 14);
        expect(pos).toHaveProperty("x");
        expect(pos).toHaveProperty("y");
        expectCloseTo(pos.x, -7604567.070035616, 0.00001);
        expectCloseTo(pos.y, -7330616.760661542, 0.00001);
    });

    it("getMercatorTileBounds #1", function () {
        let bound: MercatorBoundingBox = proj.getMercatorTileBounds({ x: 0, y: 0, z: 1 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.x, -20037508.342789, 0.00001);
        expectCloseTo(bound.leftbottom.y, 0, 0.00001);
        expectCloseTo(bound.righttop.x, 0, 0.00001);
        expectCloseTo(bound.righttop.y, 20037508.342789, 0.00001);
    });

    it("getMercatorTileBounds #2", function () {
        let bound: MercatorBoundingBox = proj.getMercatorTileBounds({ x: 5083, y: 11188, z: 14 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.x, -7604567.070035616, 0.00001);
        expectCloseTo(bound.leftbottom.y, -7330616.760661542, 0.00001);
        expectCloseTo(bound.righttop.x, -7602121.08513049, 0.00001);
        expectCloseTo(bound.righttop.y, -7328170.775756419, 0.00001);
    });

    it("getWGS84TileBounds #1", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 0, y: 0, z: 1 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.lng, -180, 0.00001);
        expectCloseTo(bound.leftbottom.lat, 0, 0.00001);
        expectCloseTo(bound.righttop.lng, 0, 0.00001);
        expectCloseTo(bound.righttop.lat, 85.051129, 0.00001);
    });

    it("getWGS84TileBounds #2", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 272, y: 177, z: 9 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.lng, 11.25, 0.00001);
        expectCloseTo(bound.leftbottom.lat, 47.98992189, 0.00001);
        expectCloseTo(bound.righttop.lng, 11.95312466, 0.00001);
        expectCloseTo(bound.righttop.lat, 48.45835188, 0.00001);
    });

    it("getWGS84TileBounds #3", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 4383, y: 2854, z: 13 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.lng, 12.61230469, 0.00001);
        expectCloseTo(bound.leftbottom.lat, 47.78363486, 0.00001);
        expectCloseTo(bound.righttop.lng, 12.65624966, 0.00001);
        expectCloseTo(bound.righttop.lat, 47.81315452, 0.00001);
    });

    it("getWGS84TileBounds #4", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 5, y: 10, z: 10 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.lng, -178.2421875, 0.00001);
        expectCloseTo(bound.leftbottom.lat, 84.706049, 0.00001);
        expectCloseTo(bound.righttop.lng, -177.890625, 0.00001);
        expectCloseTo(bound.righttop.lat, 84.738387, 0.00001);
    });

    it("getWGS84TileBounds #5 - out-of-bounds", function () {
        let bound: WGS84BoundingBox = proj.getWGS84TileBounds({ x: 100, y: 100, z: 0 });
        expect(bound).toHaveProperty("leftbottom");
        expect(bound).toHaveProperty("righttop");
        expectCloseTo(bound.leftbottom.lng, 180, 0.00001);
        expectCloseTo(bound.leftbottom.lat, -90, 0.00001);
        expectCloseTo(bound.righttop.lng, 180, 0.00001);
        expectCloseTo(bound.righttop.lat, -90, 0.00001);
    });

    it("getWGS84TileCenter #1", function () {
        let center: Wgs84 = proj.getWGS84TileCenter({ x: 0, y: 0, z: 0 });
        expect(center).toHaveProperty("lng");
        expect(center).toHaveProperty("lat");
        expectCloseTo(center.lng, 0, 0.00001);
        expectCloseTo(center.lat, 0, 0.00001);
    });

    it("getWGS84TileCenter #2", function () {
        let center: Wgs84 = proj.getWGS84TileCenter({ x: 4383, y: 2854, z: 13 }, 256);
        expect(center).toHaveProperty("lng");
        expect(center).toHaveProperty("lat");
        expectCloseTo(center.lng, 12.63427717, 0.00001);
        expectCloseTo(center.lat, 47.79839469, 0.00001);
    });

    it("getTilePyramid #1", function () {
        let list: TileList = proj.getTilePyramid({ z: 0, x: 0, y: 0 });
        expect(list).toHaveLength(5);
        expect(list[0]).toStrictEqual(<Tile>{ x: 0, y: 0, z: 0 });
        expect(list[1]).toStrictEqual(<Tile>{ x: 0, y: 0, z: 1 });
        expect(list[2]).toStrictEqual(<Tile>{ x: 1, y: 0, z: 1 });
        expect(list[3]).toStrictEqual(<Tile>{ x: 0, y: 1, z: 1 });
        expect(list[4]).toStrictEqual(<Tile>{ x: 1, y: 1, z: 1 });
    });

    it("getTilePyramid #2", function () {
        let list: TileList = proj.getTilePyramid({ z: 0, x: 0, y: 0 }, 2);
        expect(list).toHaveLength(21);
        expect(list).toContainEqual(<Tile>{ z: 0, x: 0, y: 0 });
        expect(list).toContainEqual(<Tile>{ x: 0, y: 0, z: 1 });
        expect(list).toContainEqual(<Tile>{ x: 0, y: 0, z: 2 });
    });

    it("getTilePyramid #3", function () {
        let list: TileList = proj.getTilePyramid({ z: 9, x: 271, y: 178 }, 4);
        expect(list).toHaveLength(341);
        expect(list).toContainEqual(<Tile>{ z: 13, x: 4351, y: 2863 });
        expect(list).toContainEqual(<Tile>{ z: 12, x: 2175, y: 1424 });
        expect(list).toContainEqual(<Tile>{ z: 11, x: 1084, y: 715 });
        expect(list).toContainEqual(<Tile>{ z: 10, x: 542, y: 356 });
        expect(list).toContainEqual(<Tile>{ z: 9, x: 271, y: 178 });
    });

})


