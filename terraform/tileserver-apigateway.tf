resource "aws_api_gateway_rest_api" "tileserver" {
  name = "${var.tileserver_prefix}${var.domain}"
  description = "Vectortiles Server"
  binary_media_types = [
    "*/*"
  ]
  minimum_compression_size = 5000
  endpoint_configuration {
    types = [
      "REGIONAL"
    ]
  }
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  parent_id = "${aws_api_gateway_rest_api.tileserver.root_resource_id}"
  path_part = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  resource_id = "${aws_api_gateway_resource.proxy.id}"
  http_method = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  resource_id = "${aws_api_gateway_method.proxy.resource_id}"
  http_method = "${aws_api_gateway_method.proxy.http_method}"

  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = "${aws_lambda_function.tileserver.invoke_arn}"
}

resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  resource_id = "${aws_api_gateway_rest_api.tileserver.root_resource_id}"
  http_method = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  resource_id = "${aws_api_gateway_method.proxy_root.resource_id}"
  http_method = "${aws_api_gateway_method.proxy_root.http_method}"

  integration_http_method = "POST"
  type = "AWS_PROXY"
  uri = "${aws_lambda_function.tileserver.invoke_arn}"
}

resource "aws_api_gateway_deployment" "testing" {
  depends_on = [
    "aws_api_gateway_integration.lambda",
    "aws_api_gateway_integration.lambda_root",
  ]

  rest_api_id = "${aws_api_gateway_rest_api.tileserver.id}"
  stage_name = "testing"
}


resource "aws_api_gateway_domain_name" "tileserver_domain" {
  certificate_arn = "${var.certificate_arn}"
  domain_name     = "${aws_api_gateway_rest_api.tileserver.name}"
  # security_policy = "TLS_1_2"
  endpoint_configuration {
    types = ["EDGE"]
  }
}

resource "aws_api_gateway_base_path_mapping" "tileserver_mapping" {
  api_id      = "${aws_api_gateway_rest_api.tileserver.id}"
  stage_name  = "${aws_api_gateway_deployment.testing.stage_name}"
  domain_name = "${aws_api_gateway_domain_name.tileserver_domain.domain_name}"
}