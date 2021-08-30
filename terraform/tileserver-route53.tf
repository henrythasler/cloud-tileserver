data "aws_route53_zone" "primary" {
  name = "${var.domain}"
}

# output "zone" {
#   value = "${data.aws_route53_zone.primary.zone_id}"
# }

resource "aws_route53_record" "A" {
  depends_on = [
    aws_cloudfront_distribution.website_distribution,
  ]

  zone_id = "${data.aws_route53_zone.primary.zone_id}"
  name    = "${var.domain}"
  type    = "A"

  alias {
    name    = "${aws_cloudfront_distribution.website_distribution.domain_name}"
    zone_id = "${aws_cloudfront_distribution.website_distribution.hosted_zone_id}"
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "www" {
  depends_on = [
    aws_cloudfront_distribution.website_distribution,
  ]

  zone_id = "${data.aws_route53_zone.primary.zone_id}"
  name    = "www.${var.domain}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${aws_cloudfront_distribution.website_distribution.domain_name}"]
}

resource "aws_route53_record" "tileserver" {
  depends_on = [
    aws_api_gateway_domain_name.tileserver_domain,
  ]
  zone_id = "${data.aws_route53_zone.primary.zone_id}"
  name    = "${var.tileserver_prefix}${var.domain}"
  type    = "A"

  alias {
    name    = "${aws_api_gateway_domain_name.tileserver_domain.cloudfront_domain_name}"
    zone_id = "${aws_api_gateway_domain_name.tileserver_domain.cloudfront_zone_id}"
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "tiles" {
  depends_on = [
    aws_cloudfront_distribution.tiles,
  ]
  zone_id = "${data.aws_route53_zone.primary.zone_id}"
  name    = "${var.tilecache_prefix}${var.domain}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${aws_cloudfront_distribution.tiles.domain_name}"]
}
