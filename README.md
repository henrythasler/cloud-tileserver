# aws-tileserver
Serve mapbox vectortiles via AWS stack

## Goals

These are the main project goals: 

```
[ ] Setup required AWS infrastructure with terraform

[ ] Create an AWS lambda function to handle vectortile queries via REST
[ ] Create mapbox vectortiles directly with postgis using ST_AsMvtGeom() and ST_AsMVT()
[ ] Write a parser to read config-files that define the vectortiles layout
[ ] Create fully automated deployment pipeline.
[ ] Use some caching mechanism for vectortiles
[ ] Use Typescript and typed interfaces where possible
[ ] Have module tests with tsjest/chai
[ ] Generate useful documentation with typedocs
[ ] Learn more about AWS, terraform and typescript
[✓] Have fun
```

## References

### AWS

- https://docs.aws.amazon.com/lambda/latest/dg/programming-model.html
- https://medium.com/@anjanava.biswas/nodejs-runtime-environment-with-aws-lambda-layers-f3914613e20e
- https://mikhail.io/serverless/coldstarts/aws/
- https://www.josephecombs.com/2018/03/05/how-to-make-an-AWS-S3-static-website-with-ssl
- https://medium.com/@adil/how-to-send-an-image-as-a-response-via-aws-lambda-and-api-gateway-3820f3d4b6c8
- http://erajasekar.com/posts/how-to-setup-subdomain-for-aws-api-gateway/
- https://stackoverflow.com/questions/17193647/difference-between-an-a-rec-and-cname-in-route53
- https://docs.aws.amazon.com/AmazonS3/latest/dev/how-to-page-redirect.html

### Typescript

### Terraform

- https://learn.hashicorp.com/terraform/aws/lambda-api-gateway

### Postgres

- https://node-postgres.com/