resource "aws_s3_bucket" "website" {
  bucket        = var.domain
  force_destroy = true

  provisioner "local-exec" {
    command = "aws s3 cp ../html/ s3://${aws_s3_bucket.website.bucket}/ --recursive"
  }
}

resource "aws_s3_bucket_website_configuration" "website_config" {
  bucket = aws_s3_bucket.website.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "error.html"
  }
}

resource "aws_s3_bucket_cors_configuration" "website_cors" {
  bucket = aws_s3_bucket.website.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_acl" "website_acl" {
  bucket = aws_s3_bucket.website.id
  acl    = "public-read"
}

resource "aws_s3_bucket_policy" "website_policy" {
  bucket = aws_s3_bucket.website.id
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
  bucket        = "${var.tilecache_prefix}${var.domain}"
  force_destroy = true
}

resource "aws_s3_bucket_website_configuration" "tilecache_config" {
  bucket = aws_s3_bucket.tilecache.id

  index_document {
    suffix = "index.html"
  }

  routing_rule {
    condition {
      http_error_code_returned_equals = 404
    }
    redirect {
        host_name = "${var.tileserver_prefix}${var.domain}"
        http_redirect_code = 307
        protocol= "https"
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "tilecache_cors" {
  bucket = aws_s3_bucket.tilecache.id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_acl" "tilecache_acl" {
  bucket = aws_s3_bucket.tilecache.id
  acl    = "public-read"
}

resource "aws_s3_bucket_policy" "tilecache_policy" {
  bucket = aws_s3_bucket.tilecache.id
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
