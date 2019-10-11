resource "aws_cloudfront_distribution" "website_distribution" {
  origin {
    domain_name = "${aws_s3_bucket.website.bucket_regional_domain_name}"
    origin_id   = "S3-Website"
  }

  enabled             = true
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"
  default_root_object = "index.html"

  aliases = ["cyclemap.link", "www.cyclemap.link"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Website"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = "${data.aws_acm_certificate.acm_certificate.arn}"
    minimum_protocol_version = "TLSv1.2_2018"
    ssl_support_method       = "sni-only"
  }
}


resource "aws_cloudfront_distribution" "tiles" {
  origin {
    domain_name = "${aws_s3_bucket.tilecache.website_endpoint}"
    origin_id   = "S3-Tilecache"
    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_keepalive_timeout = 5
      origin_read_timeout      = 30
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2", "TLSv1.1", "TLSv1"]
    }
  }


  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  aliases = ["tiles.cyclemap.link"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Tilecache"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 604800
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = "${data.aws_acm_certificate.acm_certificate.arn}"
    minimum_protocol_version = "TLSv1.2_2018"
    ssl_support_method       = "sni-only"
  }
}
