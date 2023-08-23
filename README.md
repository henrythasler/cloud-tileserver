# Cloud-Tileserver

[![Build Status](https://travis-ci.org/henrythasler/cloud-tileserver.svg?branch=master)](https://travis-ci.org/henrythasler/cloud-tileserver) [![Coverage Status](https://coveralls.io/repos/github/henrythasler/cloud-tileserver/badge.svg?branch=master)](https://coveralls.io/github/henrythasler/cloud-tileserver?branch=master) 
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=henrythasler_cloud-tileserver&metric=alert_status)](https://sonarcloud.io/dashboard?id=henrythasler_cloud-tileserver) 
[![Known Vulnerabilities](https://snyk.io//test/github/henrythasler/cloud-tileserver/badge.svg?targetFile=package.json)](https://snyk.io//test/github/henrythasler/cloud-tileserver?targetFile=package.json)

Serve mapbox vectortiles via AWS stack. Please visit the [Wiki](https://github.com/henrythasler/cloud-tileserver/wiki) for installation instructions.

## Goals

These are the main project goals:

```
[x] Setup the AWS infrastructure with terraform
[x] Create an AWS lambda function to handle vectortile queries via REST
[x] Create mapbox vectortiles directly with postgis using ST_AsMvtGeom() and ST_AsMVT()
[x] Write a parser to read config-files that define the vectortiles layout
[ ] Create fully automated deployment pipeline.
[x] Use some caching mechanism for vectortiles
[x] Use Typescript and typed interfaces where possible
[x] Have module tests with tsjest/chai
[ ] Generate useful documentation with typedocs
[ ] Learn more about AWS, terraform and typescript
[ ] Use free-tier if possible.
[x] Have fun
```
Checked items are already fulfilled.

## Overall Architecture

1. Client requests tile from CloudFront/S3 .
2. Missing tiles are created via API Gateway and Lambda.

![](docs/img/CloudFront-tiles-simple.png)

A more detailled description can be found in [DEVELOPMENT.md](DEVELOPMENT.md)

## Screenshots, Live Demo

The Live-Demo is available at: [cyclemap.link](https://cyclemap.link)

[![](docs/img/map_screenshot.png)](https://cyclemap.link/#15/48.17374/11.54676)

[![](docs/img/map_screenshot2.png)](https://cyclemap.link/#14/47.01863/11.5046)
