SELECT ( (SELECT ST_AsMVT(q, 'empty', 4096, 'geom') AS l FROM
        (SELECT ST_AsMvtGeom(
            ST_GeomFromText('POLYGON EMPTY'),
            ST_MakeEnvelope(0, 1, 1, 0, 4326),
            4096,
            256,
            true
            ) AS geom ) AS q) ) AS d;