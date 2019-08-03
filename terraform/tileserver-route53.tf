resource "aws_route53_zone" "primary" {
  name = "${var.domain}"
}

resource "aws_route53_record" "www" {
  zone_id = "${var.www_zone_id}"
  name    = "www.${var.domain}"
  type    = "CNAME"
  ttl     = "300"
  records = ["${aws_cloudfront_distribution.website_distribution.domain_name}"]
}

resource "aws_route53_record" "tileserver" {
  zone_id = "${var.www_zone_id}"
  name    = "tileserver.${var.domain}"
  type    = "A"
  ttl     = "300"

  alias {
    name    = "${aws_api_gateway_domain_name.tileserver_domain.cloudfront_domain_name}"
    zone_id = "${aws_api_gateway_domain_name.tileserver_domain.cloudfront_zone_id}"
    evaluate_target_health = true
  }
}
