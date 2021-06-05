resource "aws_s3_bucket" "website" {
  bucket        = "${var.domain}"
  acl           = "public-read"
  force_destroy = true

  website {
    index_document = "index.html"
    error_document = "error.html"
  }
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }

  provisioner "local-exec" {
    command = "aws s3 cp ../html/ s3://${aws_s3_bucket.website.bucket}/ --recursive"
  }
}

resource "aws_s3_bucket_policy" "website_policy" {
  bucket = "${aws_s3_bucket.website.id}"
  policy = <<EOF
{
  "Version":"2012-10-17",
  "Id": "PolicyForPublicWebsiteContent",
  "Statement":[
    {
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal": {
               "AWS": "*"
           },
      "Action":["s3:GetObject"],
      "Resource":["${aws_s3_bucket.website.arn}/*"]
      }
  ]
}
EOF
}

resource "aws_s3_bucket" "tilecache" {
  bucket = "${var.tilecache_prefix}${var.domain}"
  acl = "public-read"
  force_destroy = true

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    expose_headers = ["ETag"]
    max_age_seconds = 3600
  }

  website {
    index_document = "index.html"
    routing_rules = <<EOF
[{
    "Condition": {
        "HttpErrorCodeReturnedEquals": "404"
    },
    "Redirect": {
        "HostName": "tileserver.cyclemap.link",
        "HttpRedirectCode" : "307",
        "Protocol": "https"
    }
}]
EOF  
  }
}

resource "aws_s3_bucket_policy" "tilecache_policy" {
  bucket = "${aws_s3_bucket.tilecache.id}"
  policy = <<EOF
{
  "Version":"2012-10-17",
  "Id": "PolicyForPublicWebsiteContent",
  "Statement":[
    {
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal": {
               "AWS": "*"
           },
      "Action":["s3:GetObject"],
      "Resource":["${aws_s3_bucket.tilecache.arn}/*"]
      }
  ]
}
EOF
}
