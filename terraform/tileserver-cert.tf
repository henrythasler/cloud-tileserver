data "aws_acm_certificate" "acm_certificate" {
  provider = aws.us-east-1
  domain   = "${var.domain}"
  statuses = ["ISSUED"]
}
